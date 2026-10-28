import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** Journal des actions sensibles des opérateurs (levées d'opposition, règles, reprises). */
@Entity('operator_actions')
@Index('idx_operator_actions_actor', ['actor', 'createdAt'])
export class OperatorAction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 128 })
  actor!: string;

  @Column({ type: 'varchar', length: 64 })
  action!: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  target!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  detail!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
