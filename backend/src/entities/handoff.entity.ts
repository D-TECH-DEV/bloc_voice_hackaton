import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type HandoffStatus = 'pending' | 'claimed' | 'resolved' | 'requalified';
export type HandoffPriority = 'normal' | 'high';

/**
 * Transfert commercial : cycle de vie propre (attente, prise en charge persistée,
 * compte rendu, clôture) justifiant une entité séparée des tâches.
 */
@Entity('handoffs')
@Index('idx_handoffs_status', ['status', 'createdAt'])
export class Handoff {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'task_id', type: 'uuid', nullable: true })
  taskId!: string | null;

  @Column({ name: 'customer_ref', type: 'varchar', length: 128 })
  customerRef!: string;

  @Column({ type: 'text' })
  motive!: string;

  @Column({ type: 'text' })
  summary!: string;

  @Column({ type: 'varchar', length: 8, default: 'normal' })
  priority!: HandoffPriority;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status!: HandoffStatus;

  @Column({ name: 'claimed_by', type: 'varchar', length: 128, nullable: true })
  claimedBy!: string | null;

  @Column({ name: 'claim_report', type: 'text', nullable: true })
  claimReport!: string | null;

  /** Notification externe éventuelle (id Core) — NULL = enregistrement interne seul. */
  @Column({ name: 'external_notification_ref', type: 'varchar', length: 128, nullable: true })
  externalNotificationRef!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
