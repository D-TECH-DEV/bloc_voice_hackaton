/**
 * Fixtures de secours, explicitement fictives (seed de démonstration, AUCUNE
 * ressemblance avec des données Core réelles). Utilisées uniquement en mode
 * MOCK_CORE ; chaque réponse porte `mock: true`.
 */
export interface MockCatalogItem {
  variant_id: number;
  nom: string;
  prix: number | null;
  unite: string;
  disponible: boolean | null;
}

export const MOCK_CATALOG: MockCatalogItem[] = [
  { variant_id: 9001, nom: 'DEMO — Ciment usage général (sac 50 kg)', prix: null, unite: 'sac', disponible: null },
  { variant_id: 9002, nom: 'DEMO — Fer à béton (barre 12 m)', prix: null, unite: 'barre', disponible: null },
  { variant_id: 9003, nom: 'DEMO — Sable de construction (m³)', prix: null, unite: 'm3', disponible: null },
];

export interface MockCustomer {
  id: string;
  nom: string;
  telephone: string | null;
}

export const MOCK_CUSTOMERS: MockCustomer[] = [
  { id: 'demo-client-1', nom: 'DEMO — Client fictif Un', telephone: null },
  { id: 'demo-client-2', nom: 'DEMO — Client fictif Deux', telephone: null },
];
