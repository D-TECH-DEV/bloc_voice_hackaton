import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { conflict, notFound } from '../common/errors/api-error';
import { ConsentEvent } from '../entities/consent-event.entity';
import { VoiceConsent, type ConsentStatus } from '../entities/voice-consent.entity';

export interface ConsentInput {
  customerRef: string;
  status: ConsentStatus;
  source: string;
  proofRef?: string;
  changedBy: string;
  eventAt?: Date;
}

/**
 * Registre des consentements vocaux. Jamais de consentement par défaut :
 * une opposition prend effet immédiatement ; la levée d'opposition est
 * réservée aux opérateurs (contrôleur) et journalisée en événement.
 */
@Injectable()
export class VoiceConsentsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(VoiceConsent)
    private readonly consents: Repository<VoiceConsent>,
    @InjectRepository(ConsentEvent)
    private readonly events: Repository<ConsentEvent>,
  ) {}

  async getStatus(customerRef: string): Promise<ConsentStatus | 'unknown'> {
    const row = await this.consents.findOne({ where: { customerRef, channel: 'voice' } });
    return row?.status ?? 'unknown';
  }

  async record(input: ConsentInput): Promise<VoiceConsent> {
    const ref = input.customerRef.trim();
    if (!ref) throw conflict('Référence client vide.');
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(VoiceConsent);
      const events = manager.getRepository(ConsentEvent);
      const existing = await repo.findOne({ where: { customerRef: ref, channel: 'voice' } });
      const eventAt = input.eventAt ?? new Date();
      if (!existing) {
        const created = await repo.save(
          repo.create({
            customerRef: ref,
            channel: 'voice',
            status: input.status,
            source: input.source,
            eventAt,
            proofRef: input.proofRef ?? null,
            changedBy: input.changedBy,
          }),
        );
        await events.save(
          events.create({
            consentId: created.id,
            fromStatus: null,
            toStatus: input.status,
            source: input.source,
            proofRef: input.proofRef ?? null,
            changedBy: input.changedBy,
          }),
        );
        return created;
      }
      if (existing.status === input.status) return existing;
      const from = existing.status;
      existing.status = input.status;
      existing.source = input.source;
      existing.eventAt = eventAt;
      existing.proofRef = input.proofRef ?? existing.proofRef;
      existing.changedBy = input.changedBy;
      const saved = await repo.save(existing);
      await events.save(
        events.create({
          consentId: saved.id,
          fromStatus: from,
          toStatus: input.status,
          source: input.source,
          proofRef: input.proofRef ?? null,
          changedBy: input.changedBy,
        }),
      );
      return saved;
    });
  }

  /** Opposition : prioritaire, immédiate, idempotente. */
  async recordOptOut(customerRef: string, source: string, changedBy: string, proofRef?: string) {
    return this.record({ customerRef, status: 'refused', source, changedBy, proofRef });
  }

  async history(customerRef: string): Promise<ConsentEvent[]> {
    const consent = await this.consents.findOne({ where: { customerRef, channel: 'voice' } });
    if (!consent) throw notFound('Aucun consentement connu pour ce client (statut : inconnu).');
    return this.events.find({ where: { consentId: consent.id }, order: { createdAt: 'ASC' } });
  }
}
