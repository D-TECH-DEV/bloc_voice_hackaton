import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { conflict, forbidden, notFound } from '../common/errors/api-error';
import { Handoff, type HandoffPriority } from '../entities/handoff.entity';

/**
 * Transferts commerciaux : enregistrement interne systématique (succès = tâche
 * persistée), notification externe seulement si le contrat est validé
 * (NotificationsAdapter refuse tant que non vérifié — repli interne).
 */
@Injectable()
export class HandoffsService {
  constructor(
    @InjectRepository(Handoff)
    private readonly handoffs: Repository<Handoff>,
  ) {}

  async create(input: {
    taskId?: string;
    customerRef: string;
    motive: string;
    summary: string;
    priority?: HandoffPriority;
  }): Promise<Handoff> {
    if (!input.customerRef.trim()) throw conflict('Référence client vide.');
    if (input.motive.trim().length < 10) throw conflict('Motif de transfert insuffisant.');
    if (input.summary.trim().length === 0) throw conflict('Résumé requis.');
    return this.handoffs.save(
      this.handoffs.create({
        taskId: input.taskId ?? null,
        customerRef: input.customerRef.trim(),
        motive: input.motive.trim(),
        summary: input.summary,
        priority: input.priority ?? 'normal',
        status: 'pending',
      }),
    );
  }

  async list(status?: string): Promise<Handoff[]> {
    const qb = this.handoffs.createQueryBuilder('h').orderBy('h.createdAt', 'DESC').limit(200);
    if (status) qb.andWhere('h.status = :status', { status });
    return qb.getMany();
  }

  async getById(id: string): Promise<Handoff> {
    const handoff = await this.handoffs.findOne({ where: { id } });
    if (!handoff) throw notFound('Transfert introuvable.');
    return handoff;
  }

  /** Prise en charge persistée = accusé de reprise. */
  async claim(id: string, actor: string): Promise<Handoff> {
    const handoff = await this.getById(id);
    if (handoff.status !== 'pending') throw conflict('Transfert déjà pris en charge ou clôturé.');
    handoff.status = 'claimed';
    handoff.claimedBy = actor;
    return this.handoffs.save(handoff);
  }

  async resolve(id: string, actor: string, report: string, requalify = false): Promise<Handoff> {
    const handoff = await this.getById(id);
    if (handoff.status !== 'claimed') throw forbidden('Prise en charge requise avant clôture.');
    if (!report.trim()) throw conflict('Compte rendu requis.');
    handoff.status = requalify ? 'requalified' : 'resolved';
    handoff.claimReport = report;
    void actor;
    return this.handoffs.save(handoff);
  }
}
