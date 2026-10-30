/** Types du récapitulatif de conversation vocale (contrat backend `v1`). */

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
  source: "mock" | "core";
  fetchedAt: string;
  sousTotal: number | null;
}

export interface SessionRecap {
  version: "v1";
  sessionId: string;
  customerRef: string | null;
  statut: "active" | "ended";
  source: "mock" | "core" | "mixed";
  donneesSimulees: boolean;
  startedAt: string;
  endedAt: string | null;
  recherches: { id: string; query: string; resultCount: number; source: string; searchedAt: string }[];
  proposes: RecapItemView[];
  selectionnes: RecapItemView[];
  totalEstime: { montant: number; devise: string | null } | null;
  totalNonCalculableRaisons: string[];
  informationsManquantes: string[];
  demandeDevis: { statut: "non demandée" } | { statut: "demandée"; numero: string; simulee: boolean };
}

/** Ligne de devis commercial (contrat backend `QuoteView`). */
export interface DevisLigne {
  label: string;
  ref: string | null;
  variantId: number | null;
  qty: number | null;
  unit: string | null;
  unitPrice: number | null;
  currency: string | null;
  sousTotal: number | null;
  dispo: "disponible" | "indisponible" | "a_confirmer";
  prix: "communique" | "non_communique";
  statutFr: string;
  fetchedAt: string;
  note: string | null;
}

/** Devis finalisé : montants calculés côté backend, jamais par l'IA. */
export interface DevisPret {
  numero: string;
  sessionId: string;
  customerRef: string | null;
  statut: "provisoire" | "définitif";
  donneesSimulees: boolean;
  lignes: DevisLigne[];
  total: { montant: number; devise: string | null } | null;
  raisons: string[];
  createdAt: string;
  downloadToken: string;
}

/** Réponse de `GET /api/session-quote/[id]` : devis prêt ou non préparé. */
export type EtatDevis = { pret: false } | { pret: true; devis: DevisPret };

export function formatMontant(value: number | null, devise: string | null): string {
  if (value === null) return "indisponible";
  const arrondi = Math.round(value * 100) / 100;
  return devise ? `${arrondi} ${devise}` : `${arrondi} (devise non fournie)`;
}
