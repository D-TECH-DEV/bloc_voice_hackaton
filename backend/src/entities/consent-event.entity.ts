import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { VoiceConsent, type ConsentStatus } from './voice-consent.entity';

/**
 * Historique immuable des changements de consentement (piste d'audit).
 * On n'écrase jamais : chaque transition ajoute un événement.
 */
@Entity('consent_events')
@Index('idx_consent_events_consent', ['consentId', 'createdAt'])
export class ConsentEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'consent_id', type: 'uuid' })
  consentId!: string;

  @ManyToOne(() => VoiceConsent, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'consent_id' })
  consent!: VoiceConsent;

  @Column({ name: 'from_status', type: 'varchar', length: 16, nullable: true })
  fromStatus!: ConsentStatus | null;

  @Column({ name: 'to_status', type: 'varchar', length: 16 })
  toStatus!: ConsentStatus;

  @Column({ type: 'varchar', length: 32 })
  source!: string;

  @Column({ name: 'proof_ref', type: 'varchar', length: 256, nullable: true })
  proofRef!: string | null;

  @Column({ name: 'changed_by', type: 'varchar', length: 128 })
  changedBy!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
