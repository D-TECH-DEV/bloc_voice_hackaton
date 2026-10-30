import type { CatalogItem, CatalogSearchResult } from '../core-integration/catalog.adapter';
import { VoiceSession, VoiceSessionItem } from '../entities/voice-session.entity';
import { Quote } from './quote.entity';
import { QuotesService } from './quotes.service';

function catalogItem(over: Partial<CatalogItem> = {}): CatalogItem {
  return {
    variantId: 101,
    productId: 11,
    reference: 'REF-101',
    nom: 'Ciment CPJ 50kg',
    prix: 6500,
    devise: 'XOF',
    unite: 'sac',
    disponible: true,
    prixVerifie: true,
    dispoVerifiee: true,
    ...over,
  };
}

function stubCatalog(mode: { items?: CatalogItem[]; source?: 'mock' | 'core'; throws?: boolean }) {
  return {
    search: async (): Promise<CatalogSearchResult> => {
      if (mode.throws) throw new Error('CORE_UNAVAILABLE (simulé)');
      return {
        items: mode.items ?? [],
        mock: (mode.source ?? 'core') === 'mock',
        source: mode.source ?? 'core',
        searchedAt: new Date().toISOString(),
      };
    },
  } as unknown as import('../core-integration/catalog.adapter').CatalogAdapter;
}

interface FakeDb {
  sessions: VoiceSession[];
  items: VoiceSessionItem[];
  quotes: Quote[];
  saves: number;
}

function fakeDb(): FakeDb {
  return { sessions: [], items: [], quotes: [], saves: 0 };
}

let seq = 0;

function sessionRow(id: string): VoiceSession {
  return {
    id,
    customerRef: 'DEMO-Q01',
    status: 'ended',
    source: 'core',
    rfqNumber: null,
    rfqMock: null,
    createdBy: 'test',
    startedAt: new Date(),
    endedAt: new Date(),
  } as VoiceSession;
}

function itemRow(sessionId: string, over: Partial<VoiceSessionItem> = {}): VoiceSessionItem {
  seq += 1;
  return {
    id: `qi-${seq}`,
    sessionId,
    searchId: null,
    variantId: 101,
    ref: 'REF-101',
    label: 'Ciment CPJ 50kg',
    qty: '100',
    unit: 'sac',
    unitPrice: '1',
    currency: 'XOF',
    resolved: true,
    selected: true,
    source: 'core',
    fetchedAt: new Date(),
    ...over,
  } as VoiceSessionItem;
}

function service(db: FakeDb, catalog: ReturnType<typeof stubCatalog>): QuotesService {
  const quotesRepo = {
    findOne: async ({ where }: { where: Partial<Quote> }) =>
      db.quotes.find((q) =>
        (where.sessionId === undefined || q.sessionId === where.sessionId) &&
        (where.downloadToken === undefined || q.downloadToken === where.downloadToken),
      ) ?? null,
    create: (v: Partial<Quote>) => ({ ...v }) as Quote,
    save: async (v: Quote) => {
      db.saves += 1;
      const saved = { ...v, id: v.id ?? `q-${db.saves}`, createdAt: new Date() } as Quote;
      db.quotes.push(saved);
      return saved;
    },
  };
  const sessionsRepo = {
    findOne: async ({ where }: { where: Partial<VoiceSession> }) =>
      db.sessions.find((s) => s.id === where.id) ?? null,
  };
  const itemsRepo = {
    find: async ({ where }: { where: Partial<VoiceSessionItem> }) =>
      db.items.filter((i) => i.sessionId === where.sessionId),
  };
  return new QuotesService(
    quotesRepo as never,
    sessionsRepo as never,
    itemsRepo as never,
    catalog,
  );
}

describe('QuotesService.finalizeSession', () => {
  beforeEach(() => {
    seq = 0;
  });

  test('1+3. produit réel disponible avec prix : sous-total et total définitif', async () => {
    const db = fakeDb();
    db.sessions.push(sessionRow('s-1'));
    db.items.push(itemRow('s-1'));
    const svc = service(db, stubCatalog({ items: [catalogItem()] }));
    const view = await svc.finalizeSession('s-1');
    expect(view.numero).toMatch(/^DEV-\d{4}-[A-Z2-9]{6}$/);
    expect(view.statut).toBe('définitif');
    expect(view.lignes).toHaveLength(1);
    const l = view.lignes[0];
    expect(l.dispo).toBe('disponible');
    expect(l.statutFr).toBe('Disponible');
    expect(l.unitPrice).toBe(6500);
    expect(l.sousTotal).toBe(650000);
    expect(view.total).toEqual({ montant: 650000, devise: 'XOF' });
    expect(view.downloadToken).toMatch(/^[0-9a-f]{64}$/);
  });

  test('2. produit inexistant : disponibilité à confirmer, devis provisoire', async () => {
    const db = fakeDb();
    db.sessions.push(sessionRow('s-2'));
    db.items.push(itemRow('s-2'));
    const svc = service(db, stubCatalog({ items: [] }));
    const view = await svc.finalizeSession('s-2');
    expect(view.statut).toBe('provisoire');
    expect(view.lignes[0].dispo).toBe('a_confirmer');
    expect(view.lignes[0].statutFr).toBe('Disponibilité à confirmer');
    expect(view.total).toBeNull();
    expect(view.raisons.join(' ')).toMatch(/confirmer/i);
  });

  test('4+10. produit disponible sans prix : prix non communiqué, exclu du total', async () => {
    const db = fakeDb();
    db.sessions.push(sessionRow('s-4'));
    db.items.push(itemRow('s-4'));
    const svc = service(
      db,
      stubCatalog({ items: [catalogItem({ prix: null, devise: null, prixVerifie: false })] }),
    );
    const view = await svc.finalizeSession('s-4');
    expect(view.statut).toBe('provisoire');
    const l = view.lignes[0];
    expect(l.unitPrice).toBeNull();
    expect(l.prix).toBe('non_communique');
    expect(l.statutFr).toBe('Prix non communiqué');
    expect(view.total).toBeNull();
  });

  test("5. produit indisponible : exclu du total des commandables", async () => {
    const db = fakeDb();
    db.sessions.push(sessionRow('s-5'));
    db.items.push(itemRow('s-5'));
    const svc = service(
      db,
      stubCatalog({ items: [catalogItem({ disponible: false })] }),
    );
    const view = await svc.finalizeSession('s-5');
    expect(view.lignes[0].dispo).toBe('indisponible');
    expect(view.lignes[0].statutFr).toBe('Indisponible');
    expect(view.total).toBeNull();
    expect(view.raisons.join(' ')).toMatch(/indisponible/i);
  });

  test('6. API indisponible : devis provisoire informatif, jamais de donnée inventée', async () => {
    const db = fakeDb();
    db.sessions.push(sessionRow('s-6'));
    db.items.push(itemRow('s-6'));
    const svc = service(db, stubCatalog({ throws: true }));
    const view = await svc.finalizeSession('s-6');
    expect(view.statut).toBe('provisoire');
    expect(view.lignes[0].dispo).toBe('a_confirmer');
    expect(view.lignes[0].unitPrice).toBeNull();
    expect(view.total).toBeNull();
    expect(view.lignes[0].note).toMatch(/injoignable/i);
  });

  test('7+9. demande multi-matériaux : lignes mixtes, partiel provisoire', async () => {
    const db = fakeDb();
    db.sessions.push(sessionRow('s-7'));
    db.items.push(itemRow('s-7', { label: 'Ciment CPJ 50kg', variantId: 101, qty: '100', unit: 'sac' }));
    db.items.push(
      itemRow('s-7', { label: 'Fer à béton', variantId: 102, ref: null, qty: '2', unit: 'tonne' }),
    );
    const catalog = {
      search: async (term: string): Promise<CatalogSearchResult> => {
        if (term.includes('Ciment')) {
          return { items: [catalogItem()], mock: false, source: 'core', searchedAt: new Date().toISOString() };
        }
        return {
          items: [catalogItem({ variantId: 102, nom: 'Fer à béton', prix: null, devise: null, prixVerifie: false })],
          mock: false,
          source: 'core',
          searchedAt: new Date().toISOString(),
        };
      },
    } as unknown as import('../core-integration/catalog.adapter').CatalogAdapter;
    const svc = service(db, catalog);
    const view = await svc.finalizeSession('s-7');
    expect(view.lignes).toHaveLength(2);
    expect(view.statut).toBe('provisoire');
    // Spec §4 : total calculé uniquement sur les lignes connues, devis marqué partiel.
    expect(view.total).toEqual({ montant: 650000, devise: 'XOF' });
    expect(view.raisons.join(' ')).toMatch(/prix non communiqué/i);
  });

  test('8. quantité modifiée : la finalisation retient la valeur actuelle', async () => {
    const db = fakeDb();
    db.sessions.push(sessionRow('s-8a'), sessionRow('s-8b'));
    db.items.push(itemRow('s-8a', { qty: '10' }));
    db.items.push(itemRow('s-8b', { qty: '20' }));
    const svc = service(db, stubCatalog({ items: [catalogItem()] }));
    const avant = await svc.finalizeSession('s-8a');
    const apres = await svc.finalizeSession('s-8b');
    expect(avant.lignes[0].sousTotal).toBe(65000);
    expect(apres.lignes[0].sousTotal).toBe(130000);
    expect(avant.numero).not.toBe(apres.numero);
  });

  test('13. finalisations répétées : aucun doublon, même numéro et jeton', async () => {
    const db = fakeDb();
    db.sessions.push(sessionRow('s-13'));
    db.items.push(itemRow('s-13'));
    const svc = service(db, stubCatalog({ items: [catalogItem()] }));
    const first = await svc.finalizeSession('s-13');
    const second = await svc.finalizeSession('s-13');
    expect(second.numero).toBe(first.numero);
    expect(second.downloadToken).toBe(first.downloadToken);
    expect(db.saves).toBe(1);
  });

  test('aucune sélection : refus explicite, aucun devis', async () => {
    const db = fakeDb();
    db.sessions.push(sessionRow('s-0'));
    db.items.push(itemRow('s-0', { selected: false }));
    const svc = service(db, stubCatalog({ items: [catalogItem()] }));
    await expect(svc.finalizeSession('s-0')).rejects.toThrow(/sélection/i);
    expect(db.quotes).toHaveLength(0);
  });

  test('session inconnue : 404, aucun devis', async () => {
    const db = fakeDb();
    const svc = service(db, stubCatalog({ items: [catalogItem()] }));
    await expect(svc.finalizeSession('5458dcbf-8991-4d18-9a43-fca19a78b7ca')).rejects.toThrow(
      /introuvable/i,
    );
  });

  test('findBySession : non préparé puis prêt', async () => {
    const db = fakeDb();
    db.sessions.push(sessionRow('s-f'));
    db.items.push(itemRow('s-f'));
    const svc = service(db, stubCatalog({ items: [catalogItem()] }));
    expect(await svc.findBySession('s-f')).toEqual({ pret: false });
    const created = await svc.finalizeSession('s-f');
    const found = await svc.findBySession('s-f');
    expect(found).toEqual({ pret: true, devis: created });
  });
});

describe('QuotesService.getPdfByToken (sécurité)', () => {
  test('11+12. jeton valide : PDF ; jeton inconnu ou malformé : null (404 uniforme)', async () => {
    const db = fakeDb();
    db.sessions.push(sessionRow('s-p'));
    db.items.push(itemRow('s-p'));
    const svc = service(db, stubCatalog({ items: [catalogItem()] }));
    const view = await svc.finalizeSession('s-p');
    const found = await svc.getPdfByToken(view.downloadToken);
    expect(found).not.toBeNull();
    expect(found?.filename).toContain(view.numero);
    expect(found?.filename.endsWith('.pdf')).toBe(true);
    expect(found?.pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(await svc.getPdfByToken('f'.repeat(64))).toBeNull();
    expect(await svc.getPdfByToken(' court ')).toBeNull();
    expect(await svc.getPdfByToken(`../../../${view.numero}`)).toBeNull();
  });
});
