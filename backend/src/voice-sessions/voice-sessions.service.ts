import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { conflict, notFound } from '../common/errors/api-error';
import { BlokCoreClient } from '../core-integration/blok-core.client';
import type { CatalogSearchResult } from '../core-integration/catalog.adapter';
import {
  VoiceSession,
  VoiceSessionItem,
  VoiceSessionSearch,
} from '../entities/voice-session.entity';
import { buildRecap, type SessionRecap } from './recap';

export interface RecommendationInput {
  variantId?: number;
  ref?: string;
  label: string;
  qty?: number;
  unit?: string;
  unitPrice?: number;
  currency?: string;
}

/**
 * Contexte de conversation vocale : sessions, recherches, recommandations
 * présentées et sélections confirmées. Source de vérité persistée (PostgreSQL).
 */
@Injectable()
export class VoiceSessionsService {
  constructor(
    @InjectRepository(VoiceSession)
    private readonly sessions: Repository<VoiceSession>,
    @InjectRepository(VoiceSessionSearch)
    private readonly searches: Repository<VoiceSessionSearch>,
    @InjectRepository(VoiceSessionItem)
    private readonly items: Repository<VoiceSessionItem>,
    private readonly core: BlokCoreClient,
  ) {}

  private dataSource(): 'mock' | 'core' {
    return this.core.isMockMode() ? 'mock' : 'core';
  }

  async createSession(input: { customerRef?: string; createdBy: string }): Promise<VoiceSession> {
    const customerRef = input.customerRef?.trim() || null;
    return this.sessions.save(
      this.sessions.create({
        customerRef,
        status: 'active',
        source: this.dataSource(),
        createdBy: input.createdBy,
      }),
    );
  }

  async getSession(id: string): Promise<VoiceSession> {
    const session = await this.sessions.findOne({ where: { id } });
    if (!session) throw notFound('Session de conversation introuvable.');
    return session;
  }

  private async requireActive(id: string): Promise<VoiceSession> {
    const session = await this.getSession(id);
    if (session.status !== 'active') throw conflict('Session de conversation déjà terminée.');
    return session;
  }

  /** Enregistre une recherche (même vide) et mémorise sa source sur la session. */
  async recordSearch(sessionId: string, query: string, result: CatalogSearchResult) {
    const session = await this.requireActive(sessionId);
    const search = await this.searches.save(
      this.searches.create({
        sessionId: session.id,
        query: query.trim().slice(0, 120),
        resultCount: result.items.length,
        source: result.source,
      }),
    );
    if (session.source !== result.source && session.source !== 'mixed') {
      session.source = 'mixed';
      await this.sessions.save(session);
    }
    return search;
  }

  /** Enregistre les produits effectivement présentés (recommandations). */
  async recordRecommendations(
    sessionId: string,
    items: RecommendationInput[],
    searchId?: string,
  ): Promise<VoiceSessionItem[]> {
    const session = await this.requireActive(sessionId);
    if (items.length === 0) throw conflict('Aucune recommandation à enregistrer.');
    if (searchId) {
      const search = await this.searches.findOne({ where: { id: searchId, sessionId: session.id } });
      if (!search) throw notFound('Recherche introuvable pour cette session.');
    }
    const source = this.dataSource();
    const rows = items.map((item) => {
      if (!item.label.trim()) throw conflict('Désignation manquante sur une recommandation.');
      if (item.qty !== undefined && (!Number.isFinite(item.qty) || item.qty <= 0))
        throw conflict(`Quantité invalide pour « ${item.label} ».`);
      if (item.unitPrice !== undefined && (!Number.isFinite(item.unitPrice) || item.unitPrice < 0))
        throw conflict(`Prix invalide pour « ${item.label} ».`);
      return this.items.create({
        sessionId: session.id,
        searchId: searchId ?? null,
        variantId: item.variantId ?? null,
        ref: item.ref?.trim().slice(0, 128) || null,
        label: item.label.trim().slice(0, 256),
        qty: item.qty !== undefined ? String(item.qty) : null,
        unit: item.unit?.trim().slice(0, 32) || null,
        unitPrice: item.unitPrice !== undefined ? String(item.unitPrice) : null,
        currency: item.currency?.trim().slice(0, 8) || null,
        resolved: item.variantId !== undefined,
        selected: false,
        source,
      });
    });
    return this.items.save(rows);
  }

  /** Confirme explicitement des produits proposés (accord client requis côté outil). */
  async confirmSelections(sessionId: string, itemIds: string[]): Promise<VoiceSessionItem[]> {
    const session = await this.requireActive(sessionId);
    if (itemIds.length === 0) throw conflict('Aucune sélection à confirmer.');
    const unique = [...new Set(itemIds)];
    const rows = await this.items.find({ where: { sessionId: session.id } });
    const byId = new Map(rows.map((r) => [r.id, r]));
    for (const id of unique) {
      if (!byId.has(id)) throw notFound('Produit introuvable dans cette session.');
    }
    const selected = unique.map((id) => byId.get(id)) as VoiceSessionItem[];
    for (const row of selected) row.selected = true;
    return this.items.save(selected);
  }

  async linkRfq(sessionId: string, rfqNumber: string, mock: boolean): Promise<VoiceSession> {
    const session = await this.requireActive(sessionId);
    session.rfqNumber = rfqNumber;
    session.rfqMock = mock;
    return this.sessions.save(session);
  }

  async endSession(id: string): Promise<VoiceSession> {
    const session = await this.getSession(id);
    if (session.status === 'ended') return session; // idempotent (reconnexion)
    session.status = 'ended';
    session.endedAt = new Date();
    return this.sessions.save(session);
  }

  /** Récapitulatif fidèle : rejouable après reconnexion, isolé par session. */
  async getRecap(id: string): Promise<SessionRecap> {
    const session = await this.getSession(id);
    const [searches, items] = await Promise.all([
      this.searches.find({ where: { sessionId: id }, order: { searchedAt: 'ASC' } }),
      this.items.find({ where: { sessionId: id }, order: { fetchedAt: 'ASC' } }),
    ]);
    return buildRecap(session, searches, items);
  }
}
