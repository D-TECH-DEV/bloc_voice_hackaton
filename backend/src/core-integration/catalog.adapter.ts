import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { BlokCoreClient } from './blok-core.client';
import { MOCK_CATALOG } from './fixtures';

/**
 * Adaptateur catalogue : `POST /api/external/products`.
 * Paramètres d'après la documentation (search, limit 1–100, category_id,
 * min/max_price, organization_id). Réponse NON schématisée : validation
 * runtime permissive + extraction défensive, champs non prouvés = null.
 */
export interface CatalogItem {
  variantId: number | null;
  productId: number | null;
  /** Référence produit d'origine (NULL si la réponse ne la fournit pas). */
  reference: string | null;
  nom: string;
  prix: number | null;
  /** Devise telle que retournée (NULL si absente) : jamais supposée. */
  devise: string | null;
  unite: string | null;
  disponible: boolean | null;
  /** Vrai uniquement si le champ existait avec un type crédible dans la réponse. */
  prixVerifie: boolean;
  dispoVerifiee: boolean;
}

export interface CatalogSearchResult {
  items: CatalogItem[];
  mock: boolean;
  source: 'core' | 'mock';
  searchedAt: string;
}

const rawItemSchema = z.object({}).passthrough();
const rawListSchema = z.union([
  z.array(rawItemSchema),
  z.object({ data: z.array(rawItemSchema) }).passthrough(),
  z.object({ products: z.array(rawItemSchema) }).passthrough(),
  z.object({ items: z.array(rawItemSchema) }).passthrough(),
]);

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}
function pick(obj: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null) return obj[key];
  }
  return null;
}

function mapItem(raw: Record<string, unknown>): CatalogItem {
  const variantId = num(pick(raw, ['product_variant_id', 'variant_id']));
  const productId = num(pick(raw, ['product_id', 'id']));
  const nom = str(pick(raw, ['name', 'nom', 'label', 'designation'])) ?? 'Produit sans nom (réponse Core incomplète)';
  const prix = num(pick(raw, ['price', 'prix', 'unit_price', 'price_ttc']));
  const unite = str(pick(raw, ['unit', 'unite', 'uom']));
  const dispoRaw = pick(raw, ['available', 'disponible', 'in_stock']);
  const stockRaw = num(pick(raw, ['stock', 'stock_qty', 'quantity_available']));
  const disponible =
    typeof dispoRaw === 'boolean' ? dispoRaw : stockRaw !== null ? stockRaw > 0 : null;
  const reference = str(pick(raw, ['reference', 'ref', 'sku', 'code_produit']));
  const devise = str(pick(raw, ['currency', 'devise', 'currency_code']));
  return {
    variantId,
    productId,
    reference,
    nom,
    prix,
    devise,
    unite,
    disponible,
    prixVerifie: prix !== null,
    dispoVerifiee: disponible !== null,
  };
}

@Injectable()
export class CatalogAdapter {
  constructor(private readonly core: BlokCoreClient) {}

  async search(term: string, options: { limit?: number; categoryId?: number } = {}): Promise<CatalogSearchResult> {
    const clean = term.trim();
    if (!clean) throw new Error('Terme de recherche vide.');
    const limit = Math.min(Math.max(options.limit ?? 10, 1), 100);
    if (this.core.isMockMode()) {
      const items = MOCK_CATALOG.filter((p) =>
        p.nom.toLowerCase().includes(clean.toLowerCase()),
      ).slice(0, limit);
      return {
        items: items.map((p) => ({
          variantId: p.variant_id,
          productId: null,
          reference: null,
          nom: p.nom,
          prix: null,
          devise: null,
          unite: p.unite,
          disponible: null,
          prixVerifie: false,
          dispoVerifiee: false,
        })),
        mock: true,
        source: 'mock',
        searchedAt: new Date().toISOString(),
      };
    }
    const body: Record<string, unknown> = { search: clean, limit, offset: 0 };
    if (options.categoryId !== undefined) body.category_id = options.categoryId;
    const raw = await this.core.call<unknown>('/products', { method: 'POST', body });
    const parsed = rawListSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error('Schéma de réponse catalogue inattendu (aucune donnée inventée).');
    }
    const list = Array.isArray(parsed.data)
      ? parsed.data
      : 'data' in parsed.data
        ? parsed.data.data
        : 'products' in parsed.data
          ? parsed.data.products
          : parsed.data.items;
    return {
      items: (list as Record<string, unknown>[]).slice(0, limit).map(mapItem),
      mock: false,
      source: 'core',
      searchedAt: new Date().toISOString(),
    };
  }
}
