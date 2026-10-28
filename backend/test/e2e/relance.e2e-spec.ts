import { CallAttemptsService } from '../../src/call-attempts/call-attempts.service';
import { DueTasksScheduler } from '../../src/scheduler/due-tasks.scheduler';
import {
  ADMIN_TOKEN,
  adminAuth,
  createE2EApp,
  salesAuth,
  toolAuth,
  type E2EContext,
} from './helpers';

/**
 * Parcours critiques de bout en bout (données fictives, base de test dédiée).
 * Aucun appel réseau sortant : MOCK_CORE=true, téléphonie désactivée.
 */
describe('Relance API (e2e)', () => {
  let ctx: E2EContext;

  beforeAll(async () => {
    ctx = await createE2EApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  test('GET /health : manual_only, téléphonie non activée', async () => {
    const res = await ctx.api.get('/health').expect(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.mode).toBe('manual_only');
    expect(res.body.telephony_activated).toBe(false);
  });

  test('sans jeton : 401', async () => {
    await ctx.api.get('/api/v1/relance/tasks').expect(401);
  });

  test('création de tâche + idempotence + motif insuffisant', async () => {
    const payload = {
      customerRef: 'demo-client-1',
      kind: 'manual',
      motive: 'Demande rappelée par le client lors du salon fictif.',
      dueAt: new Date(Date.now() + 3600_000).toISOString(),
      idempotencyKey: 'e2e-tache-1',
    };
    const first = await ctx.api
      .post('/api/v1/relance/tasks')
      .set(salesAuth)
      .send(payload)
      .expect(201);
    const second = await ctx.api
      .post('/api/v1/relance/tasks')
      .set(salesAuth)
      .send(payload)
      .expect(201);
    expect(second.body.id).toBe(first.body.id);
    await ctx.api
      .post('/api/v1/relance/tasks')
      .set(salesAuth)
      .send({ ...payload, idempotencyKey: 'e2e-tache-courte', motive: 'court' })
      .expect(400);
  });

  test('sans consentement : évaluation bloquée et journalisée', async () => {
    const created = await ctx.api
      .post('/api/v1/relance/tasks')
      .set(salesAuth)
      .send({
        customerRef: 'demo-client-2',
        kind: 'manual',
        motive: 'Relance convenue après démonstration fictive du prototype.',
        dueAt: new Date(Date.now() + 3600_000).toISOString(),
        idempotencyKey: 'e2e-tache-2',
      })
      .expect(201);
    const decision = await ctx.api
      .post(`/api/v1/relance/tasks/${created.body.id}/evaluate`)
      .set(salesAuth)
      .send({})
      .expect(201);
    expect(decision.body.allowed).toBe(false);
    expect(decision.body.reasonCodes).toContain('CONSENT_MISSING');
    const log = await ctx.api.get('/api/v1/admin/decisions?limit=5').set(adminAuth).expect(200);
    expect(log.body.some((d: { taskId: string }) => d.taskId === created.body.id)).toBe(true);
  });

  test('opposition : blocage immédiat, effet sur les tâches', async () => {
    await ctx.api
      .post('/api/v1/relance/consents/opt-out')
      .set(salesAuth)
      .send({ customerRef: 'demo-client-2' })
      .expect(201);
    const status = await ctx.api.get('/api/v1/relance/consents/demo-client-2').set(salesAuth).expect(200);
    expect(status.body.status).toBe('refused');
    // Seconde opposition : idempotente (même état, pas d'erreur).
    await ctx.api
      .post('/api/v1/relance/consents/opt-out')
      .set(salesAuth)
      .send({ customerRef: 'demo-client-2' })
      .expect(201);
    const tasks = await ctx.api.get('/api/v1/relance/tasks').set(salesAuth).expect(200);
    const mine = tasks.body.find((t: { customerRef: string }) => t.customerRef === 'demo-client-2');
    const decision = await ctx.api
      .post(`/api/v1/relance/tasks/${mine.id}/evaluate`)
      .set(salesAuth)
      .send({ identityVerified: true })
      .expect(201);
    expect(decision.body.allowed).toBe(false);
    expect(decision.body.reasonCodes).toContain('OPPOSITION_EXISTS');
  });

  test('levée d’opposition réservée admin', async () => {
    await ctx.api
      .post('/api/v1/relance/consents')
      .set(salesAuth)
      .send({ customerRef: 'demo-client-2', status: 'granted', source: 'operateur' })
      .expect(403);
    await ctx.api
      .post('/api/v1/relance/consents')
      .set(adminAuth)
      .send({ customerRef: 'demo-client-2', status: 'granted', source: 'operateur' })
      .expect(201);
  });

  test('outcome "refus" : opposition automatique + tâche bloquée', async () => {
    const created = await ctx.api
      .post('/api/v1/relance/tasks')
      .set(salesAuth)
      .send({
        customerRef: 'demo-client-9',
        kind: 'manual',
        motive: 'Relance convenue après démonstration fictive du prototype.',
        dueAt: new Date(Date.now() + 3600_000).toISOString(),
        idempotencyKey: 'e2e-tache-9',
      })
      .expect(201);
    const attempts = ctx.app.get(CallAttemptsService);
    const attempt = await attempts.reserve(created.body.id, 'e2e');
    expect(attempt).not.toBeNull();
    const outcome = await ctx.api
      .post('/api/v1/relance/call-outcomes')
      .set(salesAuth)
      .send({ attemptId: attempt!.id, outcome: 'refused', summary: 'Le client refuse tout appel commercial.' })
      .expect(201);
    expect(outcome.body.outcome).toBe('refused');
    // Rejeu idempotent du même outcome.
    await ctx.api
      .post('/api/v1/relance/call-outcomes')
      .set(salesAuth)
      .send({ attemptId: attempt!.id, outcome: 'refused', summary: 'Doublon.' })
      .expect(201);
    const status = await ctx.api.get('/api/v1/relance/consents/demo-client-9').set(salesAuth).expect(200);
    expect(status.body.status).toBe('refused');
    const task = await ctx.api.get(`/api/v1/relance/tasks/${created.body.id}`).set(salesAuth).expect(200);
    expect(task.body.status).toBe('blocked');
  });

  test('réservation concurrente : un seul gagnant', async () => {
    const created = await ctx.api
      .post('/api/v1/relance/tasks')
      .set(salesAuth)
      .send({
        customerRef: 'demo-client-7',
        kind: 'manual',
        motive: 'Relance convenue après démonstration fictive du prototype.',
        dueAt: new Date(Date.now() + 3600_000).toISOString(),
        idempotencyKey: 'e2e-tache-7',
      })
      .expect(201);
    const attempts = ctx.app.get(CallAttemptsService);
    const [first, second] = await Promise.all([
      attempts.reserve(created.body.id, 'worker-a'),
      attempts.reserve(created.body.id, 'worker-b'),
    ]);
    const winners = [first, second].filter((a) => a !== null);
    expect(winners).toHaveLength(1);
  });

  test('planificateur : bloque les tâches échues sous opposition, ne compose rien', async () => {
    await ctx.api
      .post('/api/v1/relance/consents/opt-out')
      .set(adminAuth)
      .send({ customerRef: 'demo-client-3' })
      .expect(201);
    const created = await ctx.api
      .post('/api/v1/relance/tasks')
      .set(salesAuth)
      .send({
        customerRef: 'demo-client-3',
        kind: 'manual',
        motive: 'Relance convenue après démonstration fictive du prototype.',
        dueAt: new Date(Date.now() - 3600_000).toISOString(),
        idempotencyKey: 'e2e-tache-3',
      })
      .expect(201);
    const scheduler = ctx.app.get(DueTasksScheduler);
    const report = await scheduler.sweep(new Date());
    expect(report.examined).toBeGreaterThanOrEqual(1);
    expect(report.blocked).toBeGreaterThanOrEqual(1);
    const task = await ctx.api.get(`/api/v1/relance/tasks/${created.body.id}`).set(salesAuth).expect(200);
    expect(task.body.status).toBe('blocked');
  });

  test('outils vocaux : garde, catalogue, liste, RFQ, opposition, transfert', async () => {
    // Sans secret : 401 (le 503 ne survient que si le secret serveur est absent).
    await ctx.api.post('/api/v1/relance/tools/catalog-search').send({ query: 'ciment' }).expect(401);
    await ctx.api
      .post('/api/v1/relance/tools/catalog-search')
      .set({ 'x-voice-tool-secret': 'mauvais' })
      .send({ query: 'ciment' })
      .expect(401);
    const search = await ctx.api
      .post('/api/v1/relance/tools/catalog-search')
      .set(toolAuth)
      .send({ query: 'ciment' })
      .expect(201);
    expect(search.body.mock).toBe(true);
    expect(search.body.correlationId).toBeDefined();
    const list = await ctx.api
      .post('/api/v1/relance/tools/prepare-material-list')
      .set(toolAuth)
      .send({
        customerRef: 'demo-client-1',
        items: [{ label: 'Ciment (sac 50 kg)', qty: 10, unit: 'sac' }],
      })
      .expect(201);
    expect(list.body.nonResolues).toBe(1);
    // Sans confirmation explicite : 422 (le pipe de validation renverrait 400 si le champ manquait).
    await ctx.api
      .post('/api/v1/relance/tools/confirm-rfq')
      .set(toolAuth)
      .send({
        organizationId: 42,
        items: [{ label: 'Ciment (sac 50 kg)', qty: 10, unit: 'sac' }],
        confirmationClient: false,
        idempotenceKey: 'e2e-rfq-1',
      })
      .expect(422);
    const rfq = await ctx.api
      .post('/api/v1/relance/tools/confirm-rfq')
      .set(toolAuth)
      .send({
        organizationId: 42,
        items: [{ label: 'Ciment (sac 50 kg)', qty: 10, unit: 'sac' }],
        confirmationClient: true,
        idempotenceKey: 'e2e-rfq-1',
      })
      .expect(201);
    expect(rfq.body.mock).toBe(true);
    const optout = await ctx.api
      .post('/api/v1/relance/tools/record-voice-opt-out')
      .set(toolAuth)
      .send({ customerRef: 'demo-client-4' })
      .expect(201);
    expect(optout.body.effet).toBe('immediat');
    const handoff = await ctx.api
      .post('/api/v1/relance/tools/request-human-handoff')
      .set(toolAuth)
      .send({ customerRef: 'demo-client-4', motive: 'Dossier technique complexe à chiffrer.', summary: 'Client joint, demande un commercial.' })
      .expect(201);
    expect(handoff.body.statut).toBe('pending');
    // Hors allowlist : 404 (aucun outil d'appel sortant n'existe).
    await ctx.api.post('/api/v1/relance/tools/place-call').set(toolAuth).send({}).expect(404);
  });

  test('transferts : prise en charge et clôture persistées', async () => {
    const created = await ctx.api
      .post('/api/v1/relance/handoffs')
      .set(salesAuth)
      .send({
        customerRef: 'demo-client-6',
        motive: 'Dossier technique complexe à chiffrer sur site.',
        summary: 'Client joint, demande un commercial senior.',
      })
      .expect(201);
    const list = await ctx.api.get('/api/v1/relance/handoffs').set(salesAuth).expect(200);
    const pending = list.body.find((h: { id: string }) => h.id === created.body.id);
    expect(pending).toBeDefined();
    await ctx.api.post(`/api/v1/relance/handoffs/${pending.id}/claim`).set(salesAuth).expect(201);
    const resolved = await ctx.api
      .post(`/api/v1/relance/handoffs/${pending.id}/resolve`)
      .set(salesAuth)
      .send({ report: 'Client rappelé par le commercial, devis envoyé.' })
      .expect(201);
    expect(resolved.body.status).toBe('resolved');
  });

  test('listes de matériaux : confirmation explicite', async () => {
    const list = await ctx.api
      .post('/api/v1/relance/material-lists')
      .set(salesAuth)
      .send({ customerRef: 'demo-client-5', items: [{ label: 'Sable (m3)', qty: 2, unit: 'm3' }] })
      .expect(201);
    const confirmed = await ctx.api.post(`/api/v1/relance/material-lists/${list.body.id}/confirm`).set(salesAuth).expect(201);
    expect(confirmed.body.status).toBe('confirmed');
  });

  test('admin : décisions visibles admin, interdites commercial ; activations admin seul', async () => {
    await ctx.api.get('/api/v1/admin/decisions').set(salesAuth).expect(403);
    await ctx.api.get('/api/v1/admin/decisions?limit=3').set(adminAuth).expect(200);
    await ctx.api.post('/api/v1/admin/activations/telepathy_outbound_test').set(salesAuth).expect(403);
    const toggle = await ctx.api.post('/api/v1/admin/activations/telephony_outbound').set(adminAuth).expect(201);
    expect(typeof toggle.body.active).toBe('boolean');
    // Remise à l'état sûr : la téléphonie reste désactivée par défaut.
    await ctx.api.post('/api/v1/admin/activations/telephony_outbound').set(adminAuth).expect(201);
    expect(ADMIN_TOKEN).not.toBe('');
  });
});
