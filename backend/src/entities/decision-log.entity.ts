import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type Decision = 'allow' | 'block';

/**
 * Journal immuable des décisions du moteur (autorisations ET blocages).
 * Données minimales : motifs + version de règles, pas de transcription.
 */
@Entity('decision_logs')
@Index('idx_decisions_task', ['taskId', 'evaluatedAt'])
export class DecisionLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'task_id', type: 'uuid', nullable: true })
  taskId!: string | null;

  @Column({ name: 'attempt_id', type: 'uuid', nullable: true })
  attemptId!: string | null;

  @Column({ type: 'varchar', length: 8 })
  decision!: Decision;

  @Column({ name: 'evaluated_at', type: 'timestamptz' })
  evaluatedAt!: Date;

  @Column({ name: 'rule_version', type: 'varchar', length: 16 })
  ruleVersion!: string;

  @Column({ name: 'reason_codes', type: 'text', array: true })
  reasonCodes!: string[];

  /** Éléments minimaux d'audit (compteurs, délais constatés) — pas de données personnelles. */
  @Column({ type: 'jsonb', nullable: true })
  facts!: Record<string, unknown> | null;

  @Column({ name: 'requested_by', type: 'varchar', length: 128 })
  requestedBy!: string;
}
