import type { VoiceSession, VoiceSessionItem, VoiceSessionSearch } from '../entities/voice-session.entity';

/**
 * Contrat du récapitulatif de conversation (versionné : `v1`).
 * Règles : totaux calculés à la lecture uniquement ; total estimé nul dès
 * qu'un prix, une quantité ou une devise nécessaire manque (aucun total
 * trompeur) ; produits proposés distingués des produits sélectionnés.
 */
export interface RecapItemView {
  id: string;
  variantId: number | null;
  ref: string | null;
  label: string;
  qty: number | null;
  unit: string | null;
  unitPrice: number | null;
  currency: string | null;
  resolved: boolean;
  selected: boolean;
  /** 'mock' = donnée de démonstration simulée, 'core' = BLOK réel. */
  source: 'mock' | 'core';
  fetchedAt: string;
  sousTotal: number | null;
}

export interface SessionRecap {
  version: 'v1';
  sessionId: string;
  customerRef: string | null;
  statut: 'active' | 'ended';
  /** Origine globale : 'mock' (simulée), 'core' (BLOK réel), 'mixed'. */
  source: 'mock' | 'core' | 'mixed';
  /** Vrai tant que l'intégration réelle n'est pas la source exclusive. */
  donneesSimulees: boolean;
  startedAt: string;
  endedAt: string | null;
  recherches: { id: string; query: string; resultCount: number; source: string; searchedAt: string }[];
  proposes: RecapItemView[];
  selectionnes: RecapItemView[];
  totalEstime: { montant: number; devise: string | null } | null;
  totalNonCalculableRaisons: string[];
  informationsManquantes: string[];
  demandeDevis: { statut: 'non demandée' } | { statut: 'demandée'; numero: string; simulee: boolean };
}

function num(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function buildRecap(
  session: VoiceSession,
  searches: VoiceSessionSearch[],
  items: VoiceSessionItem[],
): SessionRecap {
  const proposes: RecapItemView[] = [];
  const selectionnes: RecapItemView[] = [];
  const informationsManquantes: string[] = [];

  for (const item of items) {
    const qty = num(item.qty);
    const unitPrice = num(item.unitPrice);
    const sousTotal = qty !== null && unitPrice !== null ? qty * unitPrice : null;
    const view: RecapItemView = {
      id: item.id,
      variantId: item.variantId,
      ref: item.ref,
      label: item.label,
      qty,
      unit: item.unit,
      unitPrice,
      currency: item.currency,
      resolved: item.resolved,
      selected: item.selected,
      source: item.source,
      fetchedAt: iso(item.fetchedAt),
      sousTotal,
    };
    if (item.selected) {
      selectionnes.push(view);
      if (unitPrice === null) informationsManquantes.push(`Prix indisponible pour « ${item.label} ».`);
      if (qty === null) informationsManquantes.push(`Quantité non précisée pour « ${item.label} ».`);
      if (unitPrice !== null && !item.currency)
        informationsManquantes.push(`Devise non fournie pour « ${item.label} ».`);
    } else {
      proposes.push(view);
    }
    if (item.source === 'mock' && unitPrice === null && qty !== null) {
      // Prix simulé absent : information explicitement manquante, jamais inventée.
      if (!item.selected) informationsManquantes.push(`Prix indisponible pour « ${item.label} » (donnée simulée).`);
    }
  }

  // Total estimé : uniquement sur les sélections, et seulement si tout est calculable.
  let totalEstime: SessionRecap['totalEstime'] = null;
  const totalNonCalculableRaisons: string[] = [];
  if (selectionnes.length === 0) {
    totalNonCalculableRaisons.push('Aucune sélection confirmée par le client.');
  } else {
    const incomplets = selectionnes.filter((i) => i.sousTotal === null);
    if (incomplets.length > 0) {
      totalNonCalculableRaisons.push(
        `Prix ou quantité manquant pour : ${incomplets.map((i) => `« ${i.label} »`).join(', ')}.`,
      );
    } else {
      const devises = new Set(selectionnes.map((i) => i.currency).filter(Boolean));
      const montant = selectionnes.reduce((sum, i) => sum + (i.sousTotal as number), 0);
      if (devises.size > 1) {
        totalNonCalculableRaisons.push('Devises multiples : total non additionnable en l’état.');
      } else {
        totalEstime = { montant, devise: devises.size === 1 ? [...devises][0] as string : null };
        if (totalEstime.devise === null)
          informationsManquantes.push('Devise du total non fournie par la source.');
      }
    }
  }

  return {
    version: 'v1',
    sessionId: session.id,
    customerRef: session.customerRef,
    statut: session.status,
    source: session.source,
    donneesSimulees: session.source !== 'core',
    startedAt: iso(session.startedAt),
    endedAt: session.endedAt ? iso(session.endedAt) : null,
    recherches: searches.map((s) => ({
      id: s.id,
      query: s.query,
      resultCount: s.resultCount,
      source: s.source,
      searchedAt: iso(s.searchedAt),
    })),
    proposes,
    selectionnes,
    totalEstime,
    totalNonCalculableRaisons,
    informationsManquantes,
    demandeDevis: session.rfqNumber
      ? { statut: 'demandée', numero: session.rfqNumber, simulee: session.rfqMock !== false }
      : { statut: 'non demandée' },
  };
}
