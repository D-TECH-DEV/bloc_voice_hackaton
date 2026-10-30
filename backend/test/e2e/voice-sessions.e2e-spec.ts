import {
  createE2EApp,
  salesAuth,
  toolAuth,
  type E2EContext,
} from './helpers';

/**
 * Contexte de conversation vocale : sessions, recherches, recommandations,
 * sélections confirmées et récapitulatif (données fictives, base de test dédiée).
 * MOCK_CORE=true : les prix sont absents (null) et marqués simulés.
 */
describe('Sessions vocales catalogue (e2e)', () => {
  let ctx: E2EContext;
  let sessionId: string;

  const tool = (path: string) => ctx.api.post(path).set(toolAuth);

  beforeAll(async () => {
    ctx = await createE2EApp();
    const created = await ctx.api
      .post('/api/v1/relance/voice-sessions')
      .set(salesAuth)
      .send({ customerRef: 'DEMO-VOICE-C01' })
      .expect(201);
    sessionId = created.body.id;
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  test('1. recherche avec un résultat', async () => {
    const res = await tool('/api/v1/relance/tools/catalog-search')
      .send({ query: 'ciment', sessionId })
      .expect(201);
    expect(res.body.mock).toBe(true);
    expect(res.body.sessionId).toBe(sessionId);
    expect(res.body.searchId).toBeDefined();
    expect(res.body.items).toHaveLength(1);
  });

  test('2. recherche avec plusieurs résultats', async () => {
    const res = await tool('/api/v1/relance/tools/catalog-search')
      .send({ query: 'DEMO', sessionId })
      .expect(201);
    expect(res.body.items.length).toBeGreaterThan(1);
  });

  test('3. recherche sans résultat', async () => {
    const res = await tool('/api/v1/relance/tools/catalog-search')
      .send({ query: 'xyz-introuvable-123', sessionId })
      .expect(201);
    expect(res.body.items).toHaveLength(0);
    const recap = await ctx.api
      .get(`/api/v1/relance/voice-sessions/${sessionId}/recap`)
      .set(salesAuth)
      .expect(200);
    const vide = recap.body.recherches.find((r: { query: string }) => r.query === 'xyz-introuvable-123');
    expect(vide).toBeDefined();
    expect(vide.resultCount).toBe(0);
  });

  test('4. réponse sans prix disponible', async () => {
    const res = await tool('/api/v1/relance/tools/catalog-search')
      .send({ query: 'ciment', sessionId })
      .expect(201);
    for (const item of res.body.items) {
      expect(item.prix).toBeNull();
      expect(item.prixVerifie).toBe(false);
      expect(item.dispoVerifiee).toBe(false);
      expect(item.devise).toBeNull();
    }
  });

  test('5. erreurs : session inconnue, garde outil, garde opérateur', async () => {
    const unknown = '00000000-0000-4000-8000-000000000000';
    await tool('/api/v1/relance/tools/catalog-search')
      .send({ query: 'ciment', sessionId: unknown })
      .expect(404);
    await tool('/api/v1/relance/tools/record-recommendations')
      .send({ sessionId: unknown, items: [{ label: 'X' }] })
      .expect(404);
    // Sans secret outil : 401 ; sans jeton opérateur : 401.
    await ctx.api
      .post('/api/v1/relance/tools/catalog-search')
      .send({ query: 'ciment' })
      .expect(401);
    await ctx.api.get(`/api/v1/relance/voice-sessions/${sessionId}/recap`).expect(401);
  });

  test('6. recommandation vocale fondée sur les résultats retournés', async () => {
    const search = await tool('/api/v1/relance/tools/catalog-search')
      .send({ query: 'ciment', sessionId })
      .expect(201);
    const res = await tool('/api/v1/relance/tools/record-recommendations')
      .send({
        sessionId,
        searchId: search.body.searchId,
        items: search.body.items.map((i: { nom: string; variantId: number; unite: string }) => ({
          variantId: i.variantId,
          label: i.nom,
          qty: 10,
          unit: i.unite,
        })),
      })
      .expect(201);
    expect(res.body.recommandees).toBe(search.body.items.length);
    expect(res.body.itemIds).toHaveLength(search.body.items.length);
  });

  test('7. sélection confirmée par le client (et refus sans accord)', async () => {
    const recap = await ctx.api
      .get(`/api/v1/relance/voice-sessions/${sessionId}/recap`)
      .set(salesAuth)
      .expect(200);
    const firstId = recap.body.proposes[0].id as string;
    await tool('/api/v1/relance/tools/confirm-selections')
      .send({ sessionId, itemIds: [firstId], confirmationClient: false })
      .expect(422);
    const ok = await tool('/api/v1/relance/tools/confirm-selections')
      .send({ sessionId, itemIds: [firstId], confirmationClient: true })
      .expect(201);
    expect(ok.body.confirmees).toBe(1);
  });

  test('8. produit proposé mais non sélectionné', async () => {
    const search = await tool('/api/v1/relance/tools/catalog-search')
      .send({ query: 'sable', sessionId })
      .expect(201);
    expect(search.body.items.length).toBeGreaterThan(0);
    await tool('/api/v1/relance/tools/record-recommendations')
      .send({
        sessionId,
        items: search.body.items.map((i: { nom: string; unite: string }) => ({
          label: i.nom,
          qty: 2,
          unit: i.unite,
        })),
      })
      .expect(201);
    const recap = await ctx.api
      .get(`/api/v1/relance/voice-sessions/${sessionId}/recap`)
      .set(salesAuth)
      .expect(200);
    expect(recap.body.selectionnes).toHaveLength(1);
    expect(recap.body.proposes.length).toBeGreaterThan(0);
    const proposeLabels = recap.body.proposes.map((p: { label: string }) => p.label);
    const selectedLabels = recap.body.selectionnes.map((p: { label: string }) => p.label);
    expect(proposeLabels).not.toEqual(expect.arrayContaining(selectedLabels));
  });

  test('9. fin de conversation et récapitulatif (pas de total trompeur)', async () => {
    const end = await tool('/api/v1/relance/tools/end-conversation')
      .send({ sessionId })
      .expect(201);
    expect(end.body.statut).toBe('ended');
    const recap = await ctx.api
      .get(`/api/v1/relance/voice-sessions/${sessionId}/recap`)
      .set(salesAuth)
      .expect(200);
    expect(recap.body.version).toBe('v1');
    expect(recap.body.statut).toBe('ended');
    expect(recap.body.endedAt).toBeDefined();
    expect(recap.body.donneesSimulees).toBe(true);
    // Prix simulés absents : total nul + raisons, jamais un montant inventé.
    expect(recap.body.totalEstime).toBeNull();
    expect(recap.body.totalNonCalculableRaisons.length).toBeGreaterThan(0);
    expect(recap.body.informationsManquantes.length).toBeGreaterThan(0);
    expect(recap.body.demandeDevis).toEqual({ statut: 'non demandée' });
  });

  test('10. reconnexion : récapitulatif rejouable après la fin', async () => {
    const first = await ctx.api
      .get(`/api/v1/relance/voice-sessions/${sessionId}/recap`)
      .set(salesAuth)
      .expect(200);
    const second = await ctx.api
      .get(`/api/v1/relance/voice-sessions/${sessionId}/recap`)
      .set(salesAuth)
      .expect(200);
    expect(second.body.sessionId).toBe(first.body.sessionId);
    expect(second.body.selectionnes).toHaveLength(first.body.selectionnes.length);
    expect(second.body.proposes).toHaveLength(first.body.proposes.length);
    // Fin idempotente.
    await tool('/api/v1/relance/tools/end-conversation').send({ sessionId }).expect(201);
  });

  test('11. isolation des sessions entre utilisateurs', async () => {
    const other = await ctx.api
      .post('/api/v1/relance/voice-sessions')
      .set(salesAuth)
      .send({ customerRef: 'DEMO-VOICE-C02' })
      .expect(201);
    const otherRecap = await ctx.api
      .get(`/api/v1/relance/voice-sessions/${other.body.id}/recap`)
      .set(salesAuth)
      .expect(200);
    expect(otherRecap.body.proposes).toHaveLength(0);
    expect(otherRecap.body.selectionnes).toHaveLength(0);
    // Demande de devis rattachée à la session active : statut visible au récapitulatif.
    const rfq = await tool('/api/v1/relance/tools/confirm-rfq')
      .send({
        organizationId: 7,
        items: [{ label: 'Sable DEMO (m3)', qty: 2, unit: 'm3' }],
        confirmationClient: true,
        idempotenceKey: 'e2e-voice-rfq-1',
        sessionId: other.body.id,
      })
      .expect(201);
    expect(rfq.body.mock).toBe(true);
    const otherRecap2 = await ctx.api
      .get(`/api/v1/relance/voice-sessions/${other.body.id}/recap`)
      .set(salesAuth)
      .expect(200);
    expect(otherRecap2.body.demandeDevis.statut).toBe('demandée');
    expect(otherRecap2.body.demandeDevis.simulee).toBe(true);
    // Les produits de l'autre session n'y sont pas visibles ni confirmables.
    const mine = await ctx.api
      .get(`/api/v1/relance/voice-sessions/${sessionId}/recap`)
      .set(salesAuth)
      .expect(200);
    const foreignId = mine.body.selectionnes[0].id as string;
    await tool('/api/v1/relance/tools/confirm-selections')
      .send({ sessionId: other.body.id, itemIds: [foreignId], confirmationClient: true })
      .expect(404);
    // Session terminée : plus aucune écriture (contexte figé).
    await tool('/api/v1/relance/tools/catalog-search')
      .send({ query: 'ciment', sessionId })
      .expect(409);
  });

  test('12. contrat du récapitulatif pour l’affichage frontend', async () => {
    const recap = await ctx.api
      .get(`/api/v1/relance/voice-sessions/${sessionId}/recap`)
      .set(salesAuth)
      .expect(200);
    for (const key of [
      'version',
      'statut',
      'source',
      'donneesSimulees',
      'recherches',
      'proposes',
      'selectionnes',
      'totalEstime',
      'totalNonCalculableRaisons',
      'informationsManquantes',
      'demandeDevis',
    ]) {
      expect(recap.body[key]).toBeDefined();
    }
    const all = [...recap.body.proposes, ...recap.body.selectionnes];
    for (const p of all) {
      for (const key of ['id', 'label', 'qty', 'unit', 'unitPrice', 'currency', 'selected', 'source']) {
        expect(p[key] !== undefined).toBe(true);
      }
    }
  });
});
