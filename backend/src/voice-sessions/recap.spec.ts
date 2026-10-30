import type {
  VoiceSession,
  VoiceSessionItem,
  VoiceSessionSearch,
} from '../entities/voice-session.entity';
import { buildRecap } from './recap';

function session(over: Partial<VoiceSession> = {}): VoiceSession {
  return {
    id: 'session-1',
    customerRef: 'DEMO-TEST-C01',
    status: 'active',
    source: 'mock',
    rfqNumber: null,
    rfqMock: null,
    createdBy: 'test',
    startedAt: new Date('2026-10-29T10:00:00.000Z'),
    endedAt: null,
    searches: [],
    items: [],
    ...over,
  } as VoiceSession;
}

let seq = 0;
function item(over: Partial<VoiceSessionItem> = {}): VoiceSessionItem {
  seq += 1;
  return {
    id: `item-${seq}`,
    sessionId: 'session-1',
    searchId: null,
    variantId: null,
    ref: null,
    label: 'Produit test',
    qty: null,
    unit: null,
    unitPrice: null,
    currency: null,
    resolved: false,
    selected: false,
    source: 'mock',
    fetchedAt: new Date('2026-10-29T10:05:00.000Z'),
    ...over,
  } as VoiceSessionItem;
}

function search(over: Partial<VoiceSessionSearch> = {}): VoiceSessionSearch {
  return {
    id: 'search-1',
    sessionId: 'session-1',
    query: 'ciment',
    resultCount: 1,
    source: 'mock',
    searchedAt: new Date('2026-10-29T10:04:00.000Z'),
    ...over,
  } as VoiceSessionSearch;
}

describe('buildRecap (contrat v1)', () => {
  beforeEach(() => {
    seq = 0;
  });

  test('proposés et sélectionnés distingués, total calculable', () => {
    const recap = buildRecap(
      session({}),
      [search({})],
      [
        item({ label: 'Ciment DEMO (sac)', qty: '10', unit: 'sac', unitPrice: '5000', currency: 'XOF' }),
        item({
          label: 'Fer DEMO (barre)',
          qty: '4',
          unit: 'barre',
          unitPrice: '2500',
          currency: 'XOF',
          selected: true,
        }),
      ],
    );
    expect(recap.version).toBe('v1');
    expect(recap.proposes).toHaveLength(1);
    expect(recap.selectionnes).toHaveLength(1);
    expect(recap.selectionnes[0].sousTotal).toBe(10000);
    expect(recap.totalEstime).toEqual({ montant: 10000, devise: 'XOF' });
    expect(recap.totalNonCalculableRaisons).toHaveLength(0);
    expect(recap.donneesSimulees).toBe(true);
    expect(recap.demandeDevis).toEqual({ statut: 'non demandée' });
  });

  test('prix manquant : aucun total trompeur, information signalée', () => {
    const recap = buildRecap(session({}), [search({})], [
      item({ label: 'Sable DEMO (m3)', qty: '2', unit: 'm3', selected: true }),
    ]);
    expect(recap.totalEstime).toBeNull();
    expect(recap.totalNonCalculableRaisons.join(' ')).toMatch(/Prix ou quantité manquant/);
    expect(recap.informationsManquantes.join(' ')).toMatch(/Prix indisponible/);
    // Le produit simplement proposé sans prix est aussi signalé, jamais chiffré.
    const recap2 = buildRecap(session({}), [search({})], [
      item({ label: 'Sable DEMO (m3)', qty: '2', unit: 'm3' }),
    ]);
    expect(recap2.totalEstime).toBeNull();
    expect(recap2.informationsManquantes.join(' ')).toMatch(/simulée/);
  });

  test('aucune sélection : total non calculable avec la raison exacte', () => {
    const recap = buildRecap(session({}), [], []);
    expect(recap.totalEstime).toBeNull();
    expect(recap.totalNonCalculableRaisons).toEqual(['Aucune sélection confirmée par le client.']);
  });

  test('devises multiples : total refusé', () => {
    const recap = buildRecap(session({}), [], [
      item({ label: 'A', qty: '1', unit: 'u', unitPrice: '100', currency: 'XOF', selected: true }),
      item({ label: 'B', qty: '1', unit: 'u', unitPrice: '2', currency: 'EUR', selected: true }),
    ]);
    expect(recap.totalEstime).toBeNull();
    expect(recap.totalNonCalculableRaisons.join(' ')).toMatch(/Devises multiples/);
  });

  test('demande de devis liée et source réelle', () => {
    const recap = buildRecap(
      session({ status: 'ended', source: 'core', rfqNumber: 'RFQ-42', rfqMock: false }),
      [],
      [],
    );
    expect(recap.donneesSimulees).toBe(false);
    expect(recap.statut).toBe('ended');
    expect(recap.demandeDevis).toEqual({ statut: 'demandée', numero: 'RFQ-42', simulee: false });
  });
});
