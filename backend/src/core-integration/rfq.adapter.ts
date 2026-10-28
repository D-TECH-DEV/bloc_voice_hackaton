import { createHash } from 'crypto';
import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { BlokCoreClient } from './blok-core.client';

/** Enveloppe 201 documentée : { error: false, message, data: object }. */
const rfqCreatedSchema = z.object({
  error: z.boolean(),
  message: z.string(),
  data: z.object({}).passthrough(),
});

export interface RfqLineInput {
  texte: string;
  variantId?: number;
}

export interface CreatedRfq {
  rfqNumber: string | null;
  coreData: Record<string, unknown>;
  mock: boolean;
}

@Injectable()
export class RfqAdapter {
  constructor(private readonly core: BlokCoreClient) {}

  async create(input: {
    organizationId: number;
    lines: RfqLineInput[];
    fileName?: string;
    idempotenceKey: string;
  }): Promise<CreatedRfq> {
    if (!Number.isInteger(input.organizationId)) {
      throw new Error('organization_id invalide (entier requis par le Core).');
    }
    if (input.lines.length === 0) throw new Error('RFQ sans ligne.');
    if (this.core.isMockMode()) {
      const hash = createHash('sha256').update(input.idempotenceKey).digest('hex').slice(0, 8);
      return { rfqNumber: `MOCK-${hash}`, coreData: {}, mock: true };
    }
    this.core.assertWritesEnabled();
    const body = {
      organization_id: input.organizationId,
      ...(input.fileName ? { file_name: input.fileName } : {}),
      line_items: input.lines.map((line) => ({
        extracted_text: line.texte,
        ...(line.variantId !== undefined
          ? { matched_product: { product_variant_id: line.variantId } }
          : {}),
      })),
    };
    const raw = await this.core.call<unknown>('/rfqs', { method: 'POST', body });
    const parsed = rfqCreatedSchema.safeParse(raw);
    if (!parsed.success || parsed.data.error !== false) {
      throw new Error('Réponse de création RFQ non conforme (succès non confirmé).');
    }
    const data = parsed.data.data as Record<string, unknown>;
    const rfqNumber =
      typeof data['rfq_number'] === 'string' ? (data['rfq_number'] as string) : null;
    return { rfqNumber, coreData: data, mock: false };
  }

  /** Le suivi des RFQ n'est pas exposé par l'API externe : limite explicite. */
  async track(): Promise<never> {
    throw new Error(
      'Suivi RFQ indisponible via l’API externe (ni liste, ni détail, ni statut). ' +
        'Voir docs/core-api-contracts.md §RFQ.',
    );
  }
}
