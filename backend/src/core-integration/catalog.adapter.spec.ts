import type { ConfigService } from '@nestjs/config';
import { BlokCoreClient } from './blok-core.client';
import { CatalogAdapter } from './catalog.adapter';
import type { AppConfig } from '../config/configuration';

const mockConfig = {
  get: (key: string) => {
    switch (key) {
      case 'MOCK_CORE':
        return true;
      case 'CORE_API_KEY':
        return '';
      case 'CORE_API_TIMEOUT_MS':
        return 8000;
      case 'CORE_API_BASE_URL':
        return 'https://core-api-dev.blok.africa/api/external';
      case 'ENABLE_CORE_WRITES':
        return false;
      default:
        return undefined;
    }
  },
} as unknown as ConfigService<AppConfig, true>;

describe('CatalogAdapter (mode secours)', () => {
  test('recherche mock : fanions non vérifiés, jamais de prix inventé', async () => {
    const adapter = new CatalogAdapter(new BlokCoreClient(mockConfig));
    const result = await adapter.search('ciment');
    expect(result.mock).toBe(true);
    expect(result.source).toBe('mock');
    for (const item of result.items) {
      expect(item.prix).toBeNull();
      expect(item.prixVerifie).toBe(false);
      expect(item.dispoVerifiee).toBe(false);
    }
  });

  test('terme vide : erreur contrôlée', async () => {
    const adapter = new CatalogAdapter(new BlokCoreClient(mockConfig));
    await expect(adapter.search('   ')).rejects.toThrow();
  });
});

describe('BlokCoreClient (garde-fous)', () => {
  test('écritures désactivées par défaut', () => {
    const client = new BlokCoreClient(mockConfig);
    expect(client.writesEnabled()).toBe(false);
    expect(() => client.assertWritesEnabled()).toThrow(/désactivées/);
  });
});
