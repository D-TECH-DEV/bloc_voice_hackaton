import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Canal concerné par le consentement. Un seul canal géré à ce stade. */
export const CONSENT_CHANNEL_VOICE = 'voice' as const;
/**
 * Statuts : accordé / refusé (opposition explicite) / retiré (ancien accord révoqué).
 * L'absence de ligne signifie « consentement inconnu » — jamais un accord implicite.
 */
export type ConsentStatus = 'granted' | 'refused' | 'withdrawn';

@Entity('voice_consents')
@Index('idx_voice_consents_customer', ['customerRef', 'channel'], { unique: true })
export class VoiceConsent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Référence client fournie par le Core (référence externe, pas de FK distante). */
  @Column({ name: 'customer_ref', type: 'varchar', length: 128 })
  customerRef!: string;

  @Column({ type: 'varchar', length: 32, default: CONSENT_CHANNEL_VOICE })
  channel!: string;

  @Column({ type: 'varchar', length: 16 })
  status!: ConsentStatus;

  /** Origine : agent_vocal | operateur | import | client. */
  @Column({ type: 'varchar', length: 32 })
  source!: string;

  @Column({ name: 'event_at', type: 'timestamptz' })
  eventAt!: Date;

  /** Référence de preuve (id de transcript, ticket…) — jamais la transcription intégrale. */
  @Column({ name: 'proof_ref', type: 'varchar', length: 256, nullable: true })
  proofRef!: string | null;

  @Column({ name: 'changed_by', type: 'varchar', length: 128 })
  changedBy!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
