import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type TaskKind = 'rfq_followup' | 'quote_followup' | 'project_checkin' | 'manual';
/**
 * Statuts fermés (transitions documentées dans OutreachTasksService) :
 * pending -> claimed -> in_progress -> done | blocked | awaiting_human | cancelled
 */
export type TaskStatus =
  | 'pending'
  | 'claimed'
  | 'in_progress'
  | 'done'
  | 'cancelled'
  | 'blocked'
  | 'awaiting_human';
export type TaskPriority = 'low' | 'normal' | 'high';

@Entity('outreach_tasks')
@Index('idx_tasks_status_due', ['status', 'dueAt'])
@Index('idx_tasks_customer', ['customerRef'])
@Index('idx_tasks_idempotency', ['idempotencyKey'], { unique: true })
export class OutreachTask {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'customer_ref', type: 'varchar', length: 128 })
  customerRef!: string;

  @Column({ name: 'organization_id', type: 'integer', nullable: true })
  organizationId!: number | null;

  @Column({ type: 'varchar', length: 32 })
  kind!: TaskKind;

  /** Motif commercial en clair : sans motif suffisant, le moteur bloque. */
  @Column({ type: 'text' })
  motive!: string;

  /** Référence de ressource Core (rfq_number, quote id…) si disponible. */
  @Column({ name: 'core_ref', type: 'varchar', length: 128, nullable: true })
  coreRef!: string | null;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status!: TaskStatus;

  @Column({ type: 'varchar', length: 8, default: 'normal' })
  priority!: TaskPriority;

  @Column({ name: 'due_at', type: 'timestamptz' })
  dueAt!: Date;

  @Column({ name: 'next_action', type: 'text', nullable: true })
  nextAction!: string | null;

  @Column({ name: 'attempt_count', type: 'integer', default: 0 })
  attemptCount!: number;

  @Column({ name: 'idempotency_key', type: 'varchar', length: 128 })
  idempotencyKey!: string;

  /** Dernier résultat d'évaluation du moteur (raison, codes, version de règles). */
  @Column({ name: 'last_evaluation', type: 'jsonb', nullable: true })
  lastEvaluation!: Record<string, unknown> | null;

  /** Réservation : processus qui a réservé la tâche (anti-concurrence). */
  @Column({ name: 'claimed_by', type: 'varchar', length: 128, nullable: true })
  claimedBy!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
