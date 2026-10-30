import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { conflict, notFound } from '../common/errors/api-error';
import { CatalogAdapter } from '../core-integration/catalog.adapter';
import { VoiceSession, VoiceSessionItem } from '../entities/voice-session.entity';
import { buildQuoteLine, buildQuoteTotals, type Revalidation } from './quote-lines';
import { buildQuotePdf, montantFr, statutLigneFr, type PdfLineRow } from './quote-pdf';
import { Quote, type QuoteLineSnapshot } from './quote.entity';

export interface QuoteLineView extends QuoteLineSnapshot {
  statutFr: string;
}

export interface QuoteView {
  numero: string;
  sessionId: string;
  customerRef: string | null;
  statut: 'provisoire' | 'définitif';
  source: 'mock' | 'core' | 'mixed';
  donneesSimulees: boolean;
  lignes: QuoteLineView[];
  total: { montant: number; devise: string | null } | null;
  raisons: string[];
  createdAt: string;
  downloadToken: string;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: string }).code === '23505'
  );
}

function newNumero(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(6);
  let suffix = '';
  for (const b of bytes) suffix += alphabet[b % alphabet.length];
  return `DEV-${new Date().getFullYear()}-${suffix}`;
}

function toView(quote: Quote): QuoteView {
  const lignes = (quote.lignes as QuoteLineSnapshot[]).map((l) => ({ ...l, statutFr: statutLigneFr(l) }));
  return {
    numero: quote.numero,
    sessionId: quote.sessionId,
    customerRef: quote.customerRef,
    statut: quote.statut,
    source: quote.source,
    donneesSimulees: quote.source !== 'core',
    lignes,
    total: quote.totalMontant !== null ? { montant: Number(quote.totalMontant), devise: quote.totalDevise } : null,
    raisons: quote.raisons as string[],
    createdAt: quote.createdAt instanceof Date ? quote.createdAt.toISOString() : new Date(quote.createdAt).toISOString(),
    downloadToken: quote.downloadToken,
  };
}

/**
 * Devis commerciaux générés depuis les sélections vocales confirmées.
 * - Prix et disponibilités REVÉRIFIÉS au catalogue à la génération
 *   (endpoint réel `POST /products` via CatalogAdapter) : un prix
 *   enregistré pendant l'échange n'est jamais repris comme actuel.
 * - Catalogue injoignable ou produit introuvable → ligne « à confirmer »,
 *   devis provisoire, jamais d'erreur brute ni de donnée inventée.
 * - Un seul devis par session : les finalisations répétées renvoient
 *   le devis existant (aucun doublon).
 */
@Injectable()
export class QuotesService {
  constructor(
    @InjectRepository(Quote)
    private readonly quotes: Repository<Quote>,
    @InjectRepository(VoiceSession)
    private readonly sessions: Repository<VoiceSession>,
    @InjectRepository(VoiceSessionItem)
    private readonly items: Repository<VoiceSessionItem>,
    private readonly catalog: CatalogAdapter,
  ) {}

  private async revalidate(
    label: string,
    variantId: number | null,
  ): Promise<Revalidation> {
    const fetchedAt = new Date().toISOString();
    let result;
    try {
      result = await this.catalog.search(label, { limit: 8 });
    } catch {
      return { ok: false, source: 'mock', fetchedAt };
    }
    const match =
      variantId !== null
        ? result.items.find((i) => i.variantId === variantId) ?? null
        : null;
    return { ok: true, item: match, source: result.source, fetchedAt };
  }

  private pickSource(lignes: QuoteLineSnapshot[]): 'mock' | 'core' | 'mixed' {
    const sources = new Set(lignes.map((l) => l.source));
    if (sources.size === 1) return [...sources][0];
    return 'mixed';
  }

  async finalizeSession(sessionId: string): Promise<QuoteView> {
    const existing = await this.quotes.findOne({ where: { sessionId } });
    if (existing) return toView(existing);
    const session = await this.sessions.findOne({ where: { id: sessionId } });
    if (!session) throw notFound('Session de conversation introuvable.');
    const selected = (await this.items.find({ where: { sessionId } })).filter((i) => i.selected);
    if (selected.length === 0) throw conflict('Aucune sélection confirmée : rien à deviser.');
    const lignes: QuoteLineSnapshot[] = [];
    for (const row of selected) {
      const qty = row.qty === null ? null : Number(row.qty);
      const reval = await this.revalidate(row.label, row.variantId);
      lignes.push(
        buildQuoteLine(
          {
            label: row.label,
            ref: row.ref,
            variantId: row.variantId,
            qty: qty !== null && Number.isFinite(qty) ? qty : null,
            unit: row.unit,
          },
          reval,
        ),
      );
    }
    const totals = buildQuoteTotals(lignes);
    const quote = this.quotes.create({
      numero: newNumero(),
      sessionId,
      customerRef: session.customerRef,
      statut: totals.definitif ? 'définitif' : 'provisoire',
      source: this.pickSource(lignes),
      lignes: totals.lignes,
      totalMontant: totals.totalMontant !== null ? String(totals.totalMontant) : null,
      totalDevise: totals.totalDevise,
      raisons: totals.raisons,
      downloadToken: randomBytes(32).toString('hex'),
    });
    try {
      const saved = await this.quotes.save(quote);
      return toView(saved);
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      // Course concurrente ou devis créé entre-temps : renvoyer l'existant.
      const retry = await this.quotes.findOne({ where: { sessionId } });
      if (retry) return toView(retry);
      throw error;
    }
  }

  async findBySession(sessionId: string): Promise<{ pret: false } | { pret: true; devis: QuoteView }> {
    const session = await this.sessions.findOne({ where: { id: sessionId } });
    if (!session) throw notFound('Session de conversation introuvable.');
    const quote = await this.quotes.findOne({ where: { sessionId } });
    if (!quote) return { pret: false as const };
    return { pret: true as const, devis: toView(quote) };
  }

  async getPdfByToken(
    token: string,
  ): Promise<{ filename: string; pdf: Buffer } | null> {
    if (!/^[0-9a-f]{64}$/i.test(token)) return null;
    const quote = await this.quotes.findOne({ where: { downloadToken: token.toLowerCase() } });
    if (!quote) return null;
    const view = toView(quote);
    const lignes: PdfLineRow[] = view.lignes.map((l) => ({
      designation: l.label + (l.ref ? ` (${l.ref})` : l.variantId !== null ? ` (#${l.variantId})` : ''),
      quantite: l.qty !== null ? `${l.qty}${l.unit ? ` ${l.unit}` : ''}` : 'non précisée',
      prixUnitaire: l.unitPrice !== null ? montantFr(l.unitPrice, l.currency) : 'Prix non communiqué',
      sousTotal: montantFr(l.sousTotal, l.currency),
      statut: l.statutFr,
    }));
    const pdf = buildQuotePdf({
      numero: view.numero,
      dateGeneration: new Date(view.createdAt).toLocaleString('fr-FR'),
      client: view.customerRef ?? 'non renseigné',
      statut: view.statut,
      provisoire: view.statut === 'provisoire',
      donneesSimulees: view.donneesSimulees,
      lignes,
      total: view.total ? montantFr(view.total.montant, view.total.devise) : null,
      raisons: view.raisons,
    });
    const filename = `devis-${view.numero.replace(/[^A-Za-z0-9-]/g, '-')}.pdf`;
    return { filename, pdf };
  }
}
