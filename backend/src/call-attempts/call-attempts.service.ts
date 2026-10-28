import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { conflict, notFound } from '../common/errors/api-error';
import { CallAttempt, type AttemptOutcome } from '../entities/call-attempt.entity';
import { OutreachTasksService } from '../outreach-tasks/outreach-tasks.service';
import { VoiceConsentsService } from '../voice-consents/voice-consents.service';

export interface OutcomeInput {
  attemptId: string;
  outcome: AttemptOutcome;
  summary: string;
  nextAction?: string;
  reportedBy: string;
}

/**
 * Tentatives et résultats. Distingue strictement : créée / démarrée /
 * terminée / résultat inconnu (NULL, jamais interprété comme un échec).
 * Un refus déclenche automatiquement une opposition (aucun nouvel appel).
 */
@Injectable()
export class CallAttemptsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(CallAttempt)
    private readonly attempts: Repository<CallAttempt>,
    private readonly tasks: OutreachTasksService,
    private readonly consents: VoiceConsentsService,
  ) {}

  /**
   * Réserve la tâche (atomique) et ouvre une tentative en une transaction.
   * Retourne null si la tâche n'est plus réservable (concurrence saine).
   */
  async reserve(taskId: string, actor: string): Promise<CallAttempt | null> {
    return this.dataSource.transaction(async (manager) => {
      const claimed = await this.tasks.claimForAttempt(taskId, actor);
      if (!claimed) return null;
      const repo = manager.getRepository(CallAttempt);
      const attempt = await repo.save(repo.create({ taskId, claimStatus: 'created' }));
      await this.tasks.recordAttemptStarted(taskId);
      const started = await repo.findOne({ where: { id: attempt.id } });
      if (!started) throw notFound('Tentative introuvable après création.');
      started.claimStatus = 'started';
      started.startedAt = new Date();
      return repo.save(started);
    });
  }

  async listForTask(taskId: string): Promise<CallAttempt[]> {
    await this.tasks.getById(taskId);
    return this.attempts.find({ where: { taskId }, order: { createdAt: 'ASC' } });
  }

  /** Enregistrement idempotent : un outcome déjà posé est rejoué tel quel. */
  async recordOutcome(input: OutcomeInput): Promise<CallAttempt> {
    if (input.summary.trim().length === 0) throw conflict('Résumé factuel requis.');
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(CallAttempt);
      const attempt = await repo.findOne({ where: { id: input.attemptId } });
      if (!attempt) throw notFound('Tentative introuvable.');
      if (attempt.outcome !== null) return attempt; // Idempotence.
      attempt.outcome = input.outcome;
      attempt.summary = input.summary.slice(0, 500);
      attempt.nextAction = input.nextAction ?? null;
      attempt.finishedAt = new Date();
      attempt.claimStatus = 'finished';
      const saved = await repo.save(attempt);
      const task = await this.tasks.getById(attempt.taskId);
      if (input.outcome === 'refused') {
        await this.consents.recordOptOut(task.customerRef, 'agent_vocal', input.reportedBy);
        await this.tasks.transition(task.id, 'blocked', input.reportedBy);
      } else if (input.outcome === 'completed') {
        await this.tasks.transition(task.id, 'done', input.reportedBy);
      } else if (input.outcome === 'no_answer' || input.outcome === 'failed') {
        await this.tasks.transition(task.id, 'pending', input.reportedBy);
        const reloaded = await this.tasks.getById(task.id);
        reloaded.claimedBy = null;
        await this.tasks.saveEvaluation(reloaded.id, reloaded.lastEvaluation ?? {});
      }
      return saved;
    });
  }

  /** Panne technique constatée : outcome RESTE inconnu (pas de "sans réponse" inventé). */
  async markTechnicalFailure(attemptId: string, publicError: string): Promise<CallAttempt> {
    const attempt = await this.attempts.findOne({ where: { id: attemptId } });
    if (!attempt) throw notFound('Tentative introuvable.');
    if (attempt.outcome !== null) return attempt;
    attempt.claimStatus = 'unknown';
    attempt.technicalError = publicError.slice(0, 500);
    attempt.finishedAt = new Date();
    return this.attempts.save(attempt);
  }
}
