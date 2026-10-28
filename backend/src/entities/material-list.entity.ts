import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type MaterialListStatus = 'draft' | 'confirmed';

/**
 * Brouillon de liste de matériaux : cycle de vie indépendant des appels
 * (entité dédiée, jamais rattachée artificiellement aux tentatives).
 * Une liste confirmée n'est NI un devis NI une commande.
 */
@Entity('material_lists')
@Index('idx_material_lists_customer', ['customerRef'])
export class MaterialList {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'customer_ref', type: 'varchar', length: 128 })
  customerRef!: string;

  @Column({ name: 'project_ref', type: 'varchar', length: 128, nullable: true })
  projectRef!: string | null;

  @Column({ type: 'varchar', length: 16, default: 'draft' })
  status!: MaterialListStatus;

  @Column({ name: 'created_by', type: 'varchar', length: 128 })
  createdBy!: string;

  @OneToMany(() => MaterialListItem, (item) => item.list, { cascade: true })
  items!: MaterialListItem[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

@Entity('material_list_items')
@Index('idx_material_items_list', ['listId'])
export class MaterialListItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'list_id', type: 'uuid' })
  listId!: string;

  @ManyToOne(() => MaterialList, (list) => list.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'list_id' })
  list!: MaterialList;

  /** Variante Core si résolue ; NULL = ligne non résolue (jamais substituée). */
  @Column({ name: 'variant_id', type: 'integer', nullable: true })
  variantId!: number | null;

  @Column({ name: 'free_label', type: 'varchar', length: 256 })
  freeLabel!: string;

  @Column({ type: 'numeric', precision: 14, scale: 3 })
  qty!: string;

  @Column({ type: 'varchar', length: 32 })
  unit!: string;

  @Column({ default: false })
  resolved!: boolean;

  /** Prix unitaire vérifié uniquement (NULL = non vérifié, jamais inventé). */
  @Column({ name: 'unit_price', type: 'numeric', precision: 14, scale: 2, nullable: true })
  unitPrice!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
