/**
 * Catalogue de démonstration (15 produits réels de construction - Côte d'Ivoire / Abidjan)
 * Utilisé comme plan de secours transparent si MOCK=true ou lors des démos hors-ligne.
 * Tous les prix sont en Francs CFA (XOF).
 */

export interface MockProduct {
  id: number;
  name: string;
  category: string;
  price: number;
  unit: string;
  available: boolean;
  stock: number;
  description: string;
}

export const MOCK_CATALOG: MockProduct[] = [
  {
    id: 101,
    name: "Ciment Bélier Classic CPJ 32.5 (Sac 50kg)",
    category: "Gros Œuvre - Liants",
    price: 4800,
    unit: "sac",
    available: true,
    stock: 450,
    description: "Ciment standard pour maçonnerie générale, mortiers et dallages."
  },
  {
    id: 102,
    name: "Ciment Dangote Haute Résistance CPJ 42.5 (Sac 50kg)",
    category: "Gros Œuvre - Liants",
    price: 5200,
    unit: "sac",
    available: true,
    stock: 320,
    description: "Ciment haute performance recommandé pour bétons armés et poteaux."
  },
  {
    id: 103,
    name: "Fer à Béton Tor Haute Adhérence FeE500 Diamètre 8mm (Barre 12m)",
    category: "Ferraillage",
    price: 3600,
    unit: "barre",
    available: true,
    stock: 200,
    description: "Barre de fer nervurée pour étriers, armatures secondaires et chaînages."
  },
  {
    id: 104,
    name: "Fer à Béton Tor Haute Adhérence FeE500 Diamètre 10mm (Barre 12m)",
    category: "Ferraillage",
    price: 5400,
    unit: "barre",
    available: true,
    stock: 180,
    description: "Ferraillage standard pour poutres, dalles et poteaux porteurs."
  },
  {
    id: 105,
    name: "Fer à Béton Tor Haute Adhérence FeE500 Diamètre 12mm (Barre 12m)",
    category: "Ferraillage",
    price: 7800,
    unit: "barre",
    available: true,
    stock: 150,
    description: "Armature lourde pour fondations, semelles et poutres maîtresses."
  },
  {
    id: 106,
    name: "Sable de Lagune Lavé Tamisé (Camion Benne 10 Tonnes)",
    category: "Agrégats",
    price: 85000,
    unit: "camion",
    available: true,
    stock: 15,
    description: "Sable fin propre sans débris pour mortiers d'enduit et crépissages."
  },
  {
    id: 107,
    name: "Gravier Concassé Granite 15/25 (Camion Benne 10 Tonnes)",
    category: "Agrégats",
    price: 135000,
    unit: "camion",
    available: true,
    stock: 12,
    description: "Granulats durs pour confection de bétons résistants et semelles."
  },
  {
    id: 108,
    name: "Agglos Béton Creux 15x20x40 (L'unité)",
    category: "Maçonnerie",
    price: 350,
    unit: "brique",
    available: true,
    stock: 2500,
    description: "Briques de 15 vibrées industrielles pour murs extérieurs et clôtures."
  },
  {
    id: 109,
    name: "Agglos Béton Pleins 15x20x40 (L'unité)",
    category: "Maçonnerie",
    price: 450,
    unit: "brique",
    available: true,
    stock: 1200,
    description: "Briques pleines haute résistance pour soubassements et fondations."
  },
  {
    id: 110,
    name: "Fil de Fer Recuit pour Ligature (Rouleau 25kg)",
    category: "Ferraillage",
    price: 18500,
    unit: "rouleau",
    available: true,
    stock: 45,
    description: "Fil malléable pour attachage rapide des barres d'acier sur chantier."
  },
  {
    id: 111,
    name: "Contreplaqué Coffrage Filmé Noir 15mm 244x122cm",
    category: "Coffrage & Bois",
    price: 16500,
    unit: "panneau",
    available: true,
    stock: 80,
    description: "Panneau hydrofuge réutilisable pour coulage de dalles et linteaux lisses."
  },
  {
    id: 112,
    name: "Brouette de Chantier Cuve Renforcée 90L Roue Gonflable",
    category: "Outillage",
    price: 28000,
    unit: "pièce",
    available: true,
    stock: 25,
    description: "Brouette robuste avec châssis tubulaire soudé pour transport lourd."
  },
  {
    id: 113,
    name: "Tuyau PVC Assainissement Évacuation Diamètre 110mm (Barre 4m)",
    category: "Plomberie & Réseaux",
    price: 6500,
    unit: "barre",
    available: true,
    stock: 110,
    description: "Tuyau d'évacuation des eaux vannes et pluviales avec emboîture."
  },
  {
    id: 114,
    name: "Pointes d'Acier Charpente & Coffrage 80mm (Carton 25kg)",
    category: "Quincaillerie",
    price: 21000,
    unit: "carton",
    available: true,
    stock: 35,
    description: "Pointes tête plate pour assemblage de bastaings et planches de coffrage."
  },
  {
    id: 115,
    name: "Peinture Acrylique Extérieur Mate Blanche Régal (Fût 25kg)",
    category: "Finitions & Peinture",
    price: 34000,
    unit: "fût",
    available: true,
    stock: 40,
    description: "Peinture microporeuse résistante aux intempéries et rayons UV tropicaux."
  }
];

export interface MockClient {
  id: number;
  nom: string;
  telephone: string;
  entreprise: string;
  ville: string;
  actif: boolean;
  commandes_recentes: {
    devis_id: string;
    date: string;
    montant_total: number;
    statut: string;
    articles: string[];
  }[];
}

export const MOCK_CLIENTS: MockClient[] = [
  {
    id: 501,
    nom: "Kouassi Koffi",
    telephone: "+2250707070102",
    entreprise: "BTP Ivoire Construction",
    ville: "Abidjan (Cocody Angré)",
    actif: true,
    commandes_recentes: [
      {
        devis_id: "DEV-2026-089",
        date: "2026-10-20",
        montant_total: 240000,
        statut: "Livre",
        articles: ["50 sacs Ciment Bélier", "10 barres Fer de 10"]
      }
    ]
  },
  {
    id: 502,
    nom: "Amadou Diallo",
    telephone: "+2250505050304",
    entreprise: "Entreprise Générale Diallo & Frères",
    ville: "Abidjan (Yopougon Zone Industrielle)",
    actif: true,
    commandes_recentes: [
      {
        devis_id: "DEV-2026-104",
        date: "2026-10-25",
        montant_total: 85000,
        statut: "En cours de livraison",
        articles: ["1 camion Sable de Lagune"]
      }
    ]
  }
];
