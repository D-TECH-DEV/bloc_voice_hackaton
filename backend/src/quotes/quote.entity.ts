import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Statut commercial du devis : définitif uniquement si tout est vérifié. */
export type QuoteStatus = 'provisoire' | 'définitif';

/**
 * Devis commercial généré à partir d'une session vocale.
 * - Un seul devis par session (idempotence des clics répétés).
 * - Lignes et total figés à la génération (snapshot, jamais recalculés
 *   depuis des prix obsolètes) ; le PDF est régénéré à la demande depuis
 *   ce snapshot.
 * - Téléchargement protégé par `downloadToken` imprédictible (aucune
 *   route par identifiant de session).
 */
@Entity('quotes')
@Index('uq_quotes_numero', ['numero'], { unique: true })
@Index('uq_quotes_session', ['sessionId'], { unique: true })
@Index('uq_quotes_download_token', ['downloadToken'], { unique: true })
export class Quote {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Numéro unique généré côté serveur (ex. DEV-2026-7K2Q9M). */
  @Column({ type: 'varchar', length: 32 })
  numero!: string;

  @Column({ name: 'session_id', type: 'uuid' })
  sessionId!: string;

  @Column({ name: 'customer_ref', type: 'varchar', length: 128, nullable: true })
  customerRef!: string | null;

  @Column({ type: 'varchar', length: 16, default: 'provisoire' })
  statut!: QuoteStatus;

  /** Origine des données : mock = démonstration, core = BLOK réel, mixed = mélange. */
  @Column({ type: 'varchar', length: 8, default: 'mock' })
  source!: 'mock' | 'core' | 'mixed';

  /** Lignes figées (voir QuoteLineSnapshot) : montants déjà calculés. */
  @Column({ type: 'jsonb' })
  lignes!: unknown;

  /** Total calculable, NULL si non calculable (raisons dans `raisons`). */
  @Column({ name: 'total_montant', type: 'numeric', precision: 14, scale: 2, nullable: true })
  totalMontant!: string | null;

  @Column({ name: 'total_devise', type: 'varchar', length: 8, nullable: true })
  totalDevise!: string | null;

  /** Raisons de non-calcul et informations restant à confirmer. */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  raisons!: unknown;

  /** Jeton imprédictible (hex 64 car.) : seule clé de téléchargement. */
  @Column({ name: 'download_token', type: 'varchar', length: 64 })
  downloadToken!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}

/** Disponibilité constatée lors de la revérification catalogue. */
export type LigneDispo = 'disponible' | 'indisponible' | 'a_confirmer';

/** Ligne figée du devis : prix = valeur revérifiée à la génération, jamais un ancien prix. */
export interface QuoteLineSnapshot {
  label: string;
  ref: string | null;
  variantId: number | null;
  qty: number | null;
  unit: string | null;
  unitPrice: number | null;
  currency: string | null;
  sousTotal: number | null;
  dispo: LigneDispo;
  /** 'communique' = prix revérifié fourni ; 'non_communique' = « Prix non communiqué ». */
  prix: 'communique' | 'non_communique';
  source: 'mock' | 'core';
  fetchedAt: string;
  note: string | null;
}
