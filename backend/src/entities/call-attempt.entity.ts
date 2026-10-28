import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { OutreachTask } from './outreach-task.entity';

/** Cycle de vie d'une tentative : créée -> démarrée -> terminée (ou inconnue). */
export type AttemptClaim = 'created' | 'started' | 'finished' | 'unknown';
export type AttemptOutcome = 'completed' | 'no_answer' | 'failed' | 'refused';

@Entity('call_attempts')
@Index('idx_attempts_task', ['taskId', 'createdAt'])
export class CallAttempt {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'task_id', type: 'uuid' })
  taskId!: string;

  @ManyToOne(() => OutreachTask, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_id' })
  task!: OutreachTask;

  /** Identifiant de corrélation du fournisseur, lorsqu'il existe. */
  @Column({ name: 'provider_call_id', type: 'varchar', length: 128, nullable: true })
  providerCallId!: string | null;

  @Column({ name: 'claim_status', type: 'varchar', length: 16, default: 'created' })
  claimStatus!: AttemptClaim;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt!: Date | null;

  @Column({ name: 'finished_at', type: 'timestamptz', nullable: true })
  finishedAt!: Date | null;

  /** Résultat métier. NULL = outcome pas encore reçu (jamais interprété comme un échec). */
  @Column({ type: 'varchar', length: 16, nullable: true })
  outcome!: AttemptOutcome | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  summary!: string | null;

  @Column({ name: 'next_action', type: 'text', nullable: true })
  nextAction!: string | null;

  /** Erreur technique éventuelle — expurgée de tout secret. */
  @Column({ name: 'technical_error', type: 'varchar', length: 500, nullable: true })
  technicalError!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
