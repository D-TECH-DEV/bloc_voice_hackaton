import {
  createE2EApp,
  salesAuth,
  toolAuth,
  type E2EContext,
} from './helpers';

/**
 * Devis commerciaux issus des conversations vocales (données fictives,
 * base de test dédiée). MOCK_CORE=true : aucun prix réel, devis
 * provisoire avec mentions explicites, jamais de montant inventé.
 */
describe('Devis fin de conversation (e2e)', () => {
  let ctx: E2EContext;
  let sessionId: string;

  const tool = (path: string) => ctx.api.post(path).set(toolAuth);

  beforeAll(async () => {
    ctx = await createE2EApp();
    const created = await ctx.api
      .post('/api/v1/relance/voice-sessions')
      .set(salesAuth)
      .send({ customerRef: 'DEMO-DEVIS-C01' })
      .expect(201);
    sessionId = created.body.id;
    const search = await tool('/api/v1/relance/tools/catalog-search')
      .send({ query: 'ciment', sessionId })
      .expect(201);
    const recorded = await tool('/api/v1/relance/tools/record-recommendations')
      .send({
        sessionId,
        searchId: search.body.searchId,
        items: search.body.items.map((i: { nom: string; variantId: number; unite: string }) => ({
          variantId: i.variantId,
          label: i.nom,
          qty: 100,
          unit: i.unite,
        })),
      })
      .expect(201);
    await tool('/api/v1/relance/tools/confirm-selections')
      .send({ sessionId, itemIds: recorded.body.itemIds, confirmationClient: true })
      .expect(201);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  test('1. finalisation : devis provisoire simulé, sans montant inventé', async () => {
    const res = await ctx.api
      .post('/api/v1/relance/quotes/from-session')
      .set(salesAuth)
      .send({ sessionId })
      .expect(201);
    expect(res.body.numero).toMatch(/^DEV-\d{4}-[A-Z2-9]{6}$/);
    expect(res.body.statut).toBe('provisoire');
    expect(res.body.donneesSimulees).toBe(true);
    expect(res.body.lignes).toHaveLength(1);
    expect(res.body.lignes[0].unitPrice).toBeNull();
    expect(res.body.total).toBeNull();
    expect(res.body.raisons.length).toBeGreaterThan(0);
    expect(res.body.downloadToken).toMatch(/^[0-9a-f]{64}$/);
  });

  test('2. relecture par session : prêt, même numéro', async () => {
    const res = await ctx.api
      .get(`/api/v1/relance/quotes/by-session/${sessionId}`)
      .set(salesAuth)
      .expect(200);
    expect(res.body.pret).toBe(true);
    expect(res.body.devis.numero).toMatch(/^DEV-/);
  });

  test('3. finalisations répétées : aucun doublon', async () => {
    const first = await ctx.api
      .post('/api/v1/relance/quotes/from-session')
      .set(salesAuth)
      .send({ sessionId })
      .expect(201);
    const second = await ctx.api
      .post('/api/v1/relance/quotes/from-session')
      .set(salesAuth)
      .send({ sessionId })
      .expect(201);
    expect(second.body.numero).toBe(first.body.numero);
    expect(second.body.downloadToken).toBe(first.body.downloadToken);
  });

  test('4. téléchargement PDF via jeton, 404 sinon', async () => {
    const ready = await ctx.api
      .get(`/api/v1/relance/quotes/by-session/${sessionId}`)
      .set(salesAuth)
      .expect(200);
    const token = ready.body.devis.downloadToken as string;
    const pdf = await ctx.api
      .get(`/api/v1/relance/quotes/download/${token}`)
      .expect(200);
    expect(pdf.headers['content-type']).toContain('application/pdf');
    expect(pdf.headers['content-disposition']).toContain('attachment');
    expect(pdf.headers['content-disposition']).toContain('.pdf');
    // Aucune route par identifiant de session : 404, pas de fuite inter-visiteurs.
    await ctx.api.get(`/api/v1/relance/quotes/download/${sessionId}`).expect(404);
    await ctx.api.get(`/api/v1/relance/quotes/download/${'f'.repeat(64)}`).expect(404);
    await ctx.api.get('/api/v1/relance/quotes/download/court').expect(404);
  });

  test('5. erreurs : session inconnue, sans sélection, gardes', async () => {
    const unknown = '00000000-0000-4000-8000-000000000000';
    await ctx.api
      .post('/api/v1/relance/quotes/from-session')
      .set(salesAuth)
      .send({ sessionId: unknown })
      .expect(404);
    const empty = await ctx.api
      .post('/api/v1/relance/voice-sessions')
      .set(salesAuth)
      .send({ customerRef: 'DEMO-DEVIS-VIDE' })
      .expect(201);
    await ctx.api
      .post('/api/v1/relance/quotes/from-session')
      .set(salesAuth)
      .send({ sessionId: empty.body.id })
      .expect(409);
    await ctx.api
      .post('/api/v1/relance/quotes/from-session')
      .send({ sessionId })
      .expect(401);
    await ctx.api.get(`/api/v1/relance/quotes/by-session/${sessionId}`).expect(401);
  });
});
