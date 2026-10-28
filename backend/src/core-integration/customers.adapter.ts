import { Injectable } from '@nestjs/common';
import { BlokCoreClient } from './blok-core.client';
import { MOCK_CUSTOMERS } from './fixtures';

/**
 * Adaptateur clients : `GET /api/external/customers[/{id}]`.
 * Schémas de réponse NON documentés : extraction minimale (référence + nom),
 * téléphone TOUJOURS marqué non vérifié — il ne sert jamais à composer un appel.
 */
export interface CustomerDossier {
  ref: string;
  nom: string | null;
  telephone: { value: string | null; verifie: boolean };
  mock: boolean;
  source: 'core' | 'mock';
}

function scalarRecord(raw: unknown): Record<string, unknown> {
  if (typeof raw !== 'object' || raw === null) return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (['string', 'number', 'boolean'].includes(typeof value)) out[key] = value;
  }
  return out;
}

function pick(obj: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null) return obj[key];
  }
  return null;
}

@Injectable()
export class CustomersAdapter {
  constructor(private readonly core: BlokCoreClient) {}

  async getById(id: string): Promise<CustomerDossier> {
    const ref = id.trim();
    if (!ref) throw new Error('Référence client vide.');
    if (this.core.isMockMode()) {
      const found = MOCK_CUSTOMERS.find((c) => c.id === ref) ?? null;
      return {
        ref,
        nom: found?.nom ?? null,
        telephone: { value: null, verifie: false },
        mock: true,
        source: 'mock',
      };
    }
    const raw = await this.core.call<unknown>(`/customers/${encodeURIComponent(ref)}`, {
      method: 'GET',
    });
    const fields = scalarRecord(raw);
    const nomCandidate = pick(fields, ['name', 'nom', 'full_name', 'company', 'entreprise']);
    const phoneCandidate = pick(fields, ['phone', 'telephone', 'mobile', 'phone_number']);
    return {
      ref: String(pick(fields, ['id', 'uuid', 'reference']) ?? ref),
      nom: typeof nomCandidate === 'string' ? nomCandidate : null,
      telephone: {
        value: typeof phoneCandidate === 'string' ? phoneCandidate : null,
        verifie: false, // Contrat non vérifié : valeur informative seulement.
      },
      mock: false,
      source: 'core',
    };
  }
}
