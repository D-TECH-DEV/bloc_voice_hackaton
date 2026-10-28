import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { conflict, forbidden, notFound } from '../common/errors/api-error';
import { MaterialList, MaterialListItem } from '../entities/material-list.entity';

export interface MaterialItemInput {
  variantId?: number;
  freeLabel: string;
  qty: number;
  unit: string;
}

/**
 * Brouillons de listes de matériaux. Règles : prix vérifié ou NULL,
 * ligne non résolue jamais substituée, confirmation ≠ commande.
 */
@Injectable()
export class MaterialListsService {
  constructor(
    @InjectRepository(MaterialList)
    private readonly lists: Repository<MaterialList>,
    @InjectRepository(MaterialListItem)
    private readonly items: Repository<MaterialListItem>,
  ) {}

  async create(input: {
    customerRef: string;
    projectRef?: string;
    items: MaterialItemInput[];
    createdBy: string;
  }): Promise<MaterialList> {
    if (!input.customerRef.trim()) throw conflict('Référence client vide.');
    if (input.items.length === 0) throw conflict('Liste vide.');
    for (const item of input.items) {
      if (!item.freeLabel.trim()) throw conflict('Désignation manquante sur une ligne.');
      if (!Number.isFinite(item.qty) || item.qty <= 0) {
        throw conflict(`Quantité invalide pour « ${item.freeLabel} ».`);
      }
    }
    const list = await this.lists.save(
      this.lists.create({
        customerRef: input.customerRef.trim(),
        projectRef: input.projectRef ?? null,
        status: 'draft',
        createdBy: input.createdBy,
      }),
    );
    list.items = await this.items.save(
      input.items.map((item) =>
        this.items.create({
          listId: list.id,
          variantId: item.variantId ?? null,
          freeLabel: item.freeLabel.trim(),
          qty: String(item.qty),
          unit: item.unit.trim().slice(0, 32),
          resolved: item.variantId !== undefined,
          unitPrice: null,
        }),
      ),
    );
    return list;
  }

  async getById(id: string): Promise<MaterialList> {
    const list = await this.lists.findOne({ where: { id }, relations: { items: true } });
    if (!list) throw notFound('Liste introuvable.');
    return list;
  }

  async confirm(id: string, actor: string): Promise<MaterialList> {
    const list = await this.getById(id);
    if (list.status !== 'draft') throw conflict('Liste déjà confirmée.');
    void actor;
    list.status = 'confirmed';
    return this.lists.save(list);
  }

  async setVerifiedPrice(itemId: string, unitPrice: number | null): Promise<MaterialListItem> {
    const item = await this.items.findOne({ where: { id: itemId } });
    if (!item) throw notFound('Ligne introuvable.');
    if (unitPrice !== null && (!Number.isFinite(unitPrice) || unitPrice < 0)) {
      throw forbidden('Prix invalide.');
    }
    item.unitPrice = unitPrice === null ? null : String(unitPrice);
    return this.items.save(item);
  }
}
