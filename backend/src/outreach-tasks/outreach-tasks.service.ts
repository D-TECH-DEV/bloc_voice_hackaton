import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { conflict, forbidden, notFound } from '../common/errors/api-error';
import {
  OutreachTask,
  type TaskKind,
  type TaskPriority,
} from '../entities/outreach-task.entity';

const TRANSITIONS: Record<string, string[]> = {
  pending: ['claimed', 'cancelled', 'blocked'],
  claimed: ['in_progress', 'cancelled', 'blocked'],
  in_progress: ['done', 'blocked', 'awaiting_human', 'cancelled'],
  blocked: ['pending', 'cancelled'],
  awaiting_human: ['done', 'cancelled'],
  done: [],
  cancelled: [],
};

export interface CreateTaskInput {
  customerRef: string;
  organizationId?: number;
  kind: TaskKind;
  motive: string;
  coreRef?: string;
  priority?: TaskPriority;
  dueAt: Date;
  nextAction?: string;
  idempotencyKey: string;
}

/**
 * File de tâches. Réservation atomique (UPDATE conditionnel) : deux workers
 * ne peuvent pas réserver la même tâche. Les transitions de statut sont fermées.
 */
@Injectable()
export class OutreachTasksService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(OutreachTask)
    private readonly tasks: Repository<OutreachTask>,
  ) {}

  async create(input: CreateTaskInput): Promise<OutreachTask> {
    const ref = input.customerRef.trim();
    if (!ref) throw conflict('Référence client vide.');
    if (input.motive.trim().length < 10) {
      throw conflict('Motif commercial insuffisant (10 caractères minimum).');
    }
    const existing = await this.tasks.findOne({ where: { idempotencyKey: input.idempotencyKey } });
    if (existing) return existing; // Idempotence : rejoue la tâche existante.
    return this.tasks.save(
      this.tasks.create({
        customerRef: ref,
        organizationId: input.organizationId ?? null,
        kind: input.kind,
        motive: input.motive.trim(),
        coreRef: input.coreRef ?? null,
        status: 'pending',
        priority: input.priority ?? 'normal',
        dueAt: input.dueAt,
        nextAction: input.nextAction ?? null,
        attemptCount: 0,
        idempotencyKey: input.idempotencyKey,
      }),
    );
  }

  async getById(id: string): Promise<OutreachTask> {
    const task = await this.tasks.findOne({ where: { id } });
    if (!task) throw notFound('Tâche introuvable.');
    return task;
  }

  async list(filters: { status?: string; dueBefore?: Date; limit?: number }): Promise<OutreachTask[]> {
    const qb = this.tasks.createQueryBuilder('t').orderBy('t.dueAt', 'ASC');
    if (filters.status) qb.andWhere('t.status = :status', { status: filters.status });
    if (filters.dueBefore) qb.andWhere('t.dueAt <= :due', { due: filters.dueBefore });
    qb.limit(Math.min(Math.max(filters.limit ?? 50, 1), 200));
    return qb.getMany();
  }

  async transition(id: string, to: string, actor: string): Promise<OutreachTask> {
    const task = await this.getById(id);
    const allowed = TRANSITIONS[task.status] ?? [];
    if (!allowed.includes(to)) {
      throw conflict(`Transition interdite : ${task.status} -> ${to}.`);
    }
    task.status = to as OutreachTask['status'];
    if (to === 'claimed') task.claimedBy = actor;
    if (to === 'pending') task.claimedBy = null;
    return this.tasks.save(task);
  }

  /**
   * Réservation atomique pour tentative : réussit pour un seul worker.
   * Retourne la tâche réservée ou null si déjà prise / non en attente.
   */
  async claimForAttempt(id: string, actor: string): Promise<OutreachTask | null> {
    const result = await this.tasks
      .createQueryBuilder()
      .update(OutreachTask)
      .set({ status: 'claimed', claimedBy: actor })
      .where('id = :id', { id })
      .andWhere('status = :status', { status: 'pending' })
      .returning('*')
      .execute();
    const rows = (result.raw as unknown[])[0] as OutreachTask | undefined;
    void actor;
    return rows ?? null;
  }

  async recordAttemptStarted(id: string): Promise<OutreachTask> {
    const task = await this.getById(id);
    if (task.status !== 'claimed') {
      throw forbidden('Tâche non réservée : réservation requise avant tentative.');
    }
    task.status = 'in_progress';
    task.attemptCount += 1;
    return this.tasks.save(task);
  }

  async saveEvaluation(id: string, evaluation: Record<string, unknown>): Promise<OutreachTask> {
    const task = await this.getById(id);
    task.lastEvaluation = evaluation;
    return this.tasks.save(task);
  }
}
