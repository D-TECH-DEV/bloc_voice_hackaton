import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type VoiceSessionStatus = 'active' | 'ended';
/** Origine des données : mock = démonstration simulée, core = BLOK réel, mixed = mélange. */
export type VoiceDataSource = 'mock' | 'core' | 'mixed';

/**
 * Session de conversation vocale : contexte auquel sont rattachés les
 * recherches catalogue, les recommandations présentées et les sélections
 * explicitement confirmées. Aucune transcription stockée.
 */
@Entity('voice_sessions')
@Index('idx_voice_sessions_customer', ['customerRef'])
export class VoiceSession {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'customer_ref', type: 'varchar', length: 128, nullable: true })
  customerRef!: string | null;

  @Column({ type: 'varchar', length: 16, default: 'active' })
  status!: VoiceSessionStatus;

  @Column({ type: 'varchar', length: 8, default: 'mock' })
  source!: VoiceDataSource;

  /** Référence de demande de devis liée via confirm-rfq (NULL = non demandée). */
  @Column({ name: 'rfq_number', type: 'varchar', length: 128, nullable: true })
  rfqNumber!: string | null;

  @Column({ name: 'rfq_mock', type: 'boolean', nullable: true })
  rfqMock!: boolean | null;

  @Column({ name: 'created_by', type: 'varchar', length: 128 })
  createdBy!: string;

  @CreateDateColumn({ name: 'started_at' })
  startedAt!: Date;

  @Column({ name: 'ended_at', type: 'timestamptz', nullable: true })
  endedAt!: Date | null;

  @OneToMany(() => VoiceSessionSearch, (search) => search.session)
  searches!: VoiceSessionSearch[];

  @OneToMany(() => VoiceSessionItem, (item) => item.session)
  items!: VoiceSessionItem[];
}

/** Recherche catalogue effectuée dans le contexte d'une session (même vide). */
@Entity('voice_session_searches')
@Index('idx_voice_searches_session', ['sessionId'])
export class VoiceSessionSearch {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'session_id', type: 'uuid' })
  sessionId!: string;

  @ManyToOne(() => VoiceSession, (session) => session.searches, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'session_id' })
  session!: VoiceSession;

  @Column({ type: 'varchar', length: 120 })
  query!: string;

  @Column({ name: 'result_count', type: 'integer', default: 0 })
  resultCount!: number;

  @Column({ type: 'varchar', length: 8, default: 'mock' })
  source!: 'mock' | 'core';

  @CreateDateColumn({ name: 'searched_at' })
  searchedAt!: Date;
}

/**
 * Produit récupéré pendant une session.
 * `selected = false` : simplement proposé ; `selected = true` : confirmé
 * explicitement par le client. Prix/devise NULL = indisponible, jamais inventé.
 */
@Entity('voice_session_items')
@Index('idx_voice_items_session', ['sessionId'])
export class VoiceSessionItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'session_id', type: 'uuid' })
  sessionId!: string;

  @ManyToOne(() => VoiceSession, (session) => session.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'session_id' })
  session!: VoiceSession;

  @Column({ name: 'search_id', type: 'uuid', nullable: true })
  searchId!: string | null;

  @Column({ name: 'variant_id', type: 'integer', nullable: true })
  variantId!: number | null;

  /** Référence produit d'origine conservée (NULL si non fournie). */
  @Column({ type: 'varchar', length: 128, nullable: true })
  ref!: string | null;

  @Column({ type: 'varchar', length: 256 })
  label!: string;

  @Column({ type: 'numeric', precision: 14, scale: 3, nullable: true })
  qty!: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  unit!: string | null;

  /** Prix unitaire tel que retourné à la récupération (NULL = indisponible). */
  @Column({ name: 'unit_price', type: 'numeric', precision: 14, scale: 2, nullable: true })
  unitPrice!: string | null;

  @Column({ type: 'varchar', length: 8, nullable: true })
  currency!: string | null;

  /** Vrai si rattaché à une variante catalogue identifiée. */
  @Column({ default: false })
  resolved!: boolean;

  @Column({ default: false })
  selected!: boolean;

  @Column({ type: 'varchar', length: 8, default: 'mock' })
  source!: 'mock' | 'core';

  @CreateDateColumn({ name: 'fetched_at' })
  fetchedAt!: Date;
}
