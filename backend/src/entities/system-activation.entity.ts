import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Verrous d'activation explicites (double verrou avec la configuration).
 * Ex. `telephony_outbound` : l'appel sortant exige ce flag actif EN BASE
 * ET `OUTBOUND_CALLS_ENABLED=true` dans l'environnement.
 */
@Entity('system_activations')
export class SystemActivation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 64, unique: true })
  key!: string;

  @Column({ default: false })
  active!: boolean;

  @Column({ name: 'activated_by', type: 'varchar', length: 128, nullable: true })
  activatedBy!: string | null;

  @Column({ name: 'activated_at', type: 'timestamptz', nullable: true })
  activatedAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
