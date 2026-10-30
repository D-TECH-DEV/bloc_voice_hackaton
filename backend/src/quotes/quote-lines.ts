import type { CatalogItem } from '../core-integration/catalog.adapter';
import type { QuoteLineSnapshot } from './quote.entity';

/**
 * Construction déterministe des lignes de devis et du total.
 * Fonctions pures (aucun accès réseau ni base) : toute la logique
 * commerciale testable sans infrastructure.
 *
 * Règles impératives :
 * - le prix retenu est celui revérifié à l'instant (`prixVerifie`) ;
 *   un prix enregistré plus tôt n'est jamais repris comme actuel ;
 * - prix absent → « Prix non communiqué », ligne exclue du total ;
 * - disponibilité non vérifiable → « Disponibilité à confirmer » ;
 * - produit indisponible → « Indisponible », exclu du total ;
 * - total = somme des sous-totaux calculables, devise unique exigée.
 */

export interface SelectedLineInput {
  label: string;
  ref: string | null;
  variantId: number | null;
  qty: number | null;
  unit: string | null;
}

/** Résultat d'une revérification catalogue pour une ligne (ou échec). */
export type Revalidation =
  | { ok: true; item: CatalogItem | null; source: 'mock' | 'core'; fetchedAt: string }
  | { ok: false; source: 'mock' | 'core'; fetchedAt: string };

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function buildQuoteLine(input: SelectedLineInput, reval: Revalidation): QuoteLineSnapshot {
  const base = {
    label: input.label,
    ref: input.ref,
    variantId: input.variantId,
    qty: input.qty,
    unit: input.unit,
    fetchedAt: reval.fetchedAt,
    source: reval.source,
  };
  if (!reval.ok || reval.item === null) {
    return {
      ...base,
      unitPrice: null,
      currency: null,
      sousTotal: null,
      dispo: 'a_confirmer',
      prix: 'non_communique',
      note: reval.ok
        ? 'Produit introuvable au catalogue lors de la finalisation : disponibilité à confirmer.'
        : 'Catalogue injoignable lors de la finalisation : disponibilité à confirmer.',
    };
  }
  const item = reval.item;
  const prixConnu = item.prixVerifie && item.prix !== null;
  const unitPrice = prixConnu ? item.prix : null;
  const currency = prixConnu ? item.devise : null;
  const sousTotal =
    unitPrice !== null && input.qty !== null ? round2(unitPrice * input.qty) : null;
  const dispo: QuoteLineSnapshot['dispo'] = item.dispoVerifiee
    ? item.disponible === true
      ? 'disponible'
      : 'indisponible'
    : 'a_confirmer';
  return {
    ...base,
    unitPrice,
    currency,
    sousTotal,
    dispo,
    prix: prixConnu ? 'communique' : 'non_communique',
    note:
      dispo === 'indisponible'
        ? 'Produit indisponible : exclu du total des produits commandables.'
        : !prixConnu
          ? 'Prix non communiqué : aucun montant fictif intégré au total.'
          : dispo === 'a_confirmer'
            ? 'Disponibilité à confirmer.'
            : null,
  };
}

export interface QuoteTotals {
  lignes: QuoteLineSnapshot[];
  totalMontant: number | null;
  totalDevise: string | null;
  raisons: string[];
  definitif: boolean;
}

export function buildQuoteTotals(lignes: QuoteLineSnapshot[]): QuoteTotals {
  const raisons: string[] = [];
  const calculables = lignes.filter(
    (l) => l.sousTotal !== null && l.dispo === 'disponible' && l.prix === 'communique',
  );
  const indisponibles = lignes.filter((l) => l.dispo === 'indisponible');
  const sansPrix = lignes.filter((l) => l.prix === 'non_communique');
  const aConfirmer = lignes.filter((l) => l.dispo === 'a_confirmer');
  for (const l of indisponibles) raisons.push(`« ${l.label} » : indisponible, exclu du total.`);
  for (const l of sansPrix) raisons.push(`« ${l.label} » : prix non communiqué, aucun montant intégré.`);
  for (const l of aConfirmer)
    raisons.push(`« ${l.label} » : disponibilité à confirmer, non comptabilisé comme disponible.`);
  let totalMontant: number | null = null;
  let totalDevise: string | null = null;
  if (calculables.length === 0) {
    raisons.push('Aucune ligne entièrement calculable : total non calculable.');
  } else {
    const devises = new Set(calculables.map((l) => l.currency).filter(Boolean));
    if (devises.size > 1) {
      raisons.push('Devises multiples : total non additionnable en l’état.');
    } else {
      totalMontant = round2(calculables.reduce((s, l) => s + (l.sousTotal as number), 0));
      totalDevise = devises.size === 1 ? ([...devises][0] as string) : null;
      if (totalDevise === null) raisons.push('Devise du total non fournie par la source.');
    }
  }
  const definitif =
    totalMontant !== null &&
    indisponibles.length === 0 &&
    sansPrix.length === 0 &&
    aConfirmer.length === 0;
  return { lignes, totalMontant, totalDevise, raisons, definitif };
}
