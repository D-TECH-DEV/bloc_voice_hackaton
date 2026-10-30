// Seed de démonstration BLOK Relance — jury hackathon AethexAI × Mstudio.
//
// Usage (depuis l'hôte) :
//   docker exec blok-relance-backend-api-1 node scripts/seed-demo.mjs
// Réexécutable sans doublons : clés stables `demo-jury-*` (idempotence
// API + ON CONFLICT DO NOTHING en SQL) + vérifications avant création.
// Données 100 % fictives (refs DEMO-JURY-*, téléphones 00 000 000 00).
// Aucun appel, aucune notification, aucun paiement, Core en mock.
//
// Tables écrites via API : outreach_tasks, voice_consents (+events),
// decision_logs (via evaluate), handoffs, material_lists (+items),
// operator_actions (traçabilité auto), system_activations (jamais).
// Tables écrites en SQL direct (pas d'endpoint) : call_attempts +
// transitions associées + 1 decision d'exemple `allow` seedée.

import pg from 'pg';

const BASE = 'http://127.0.0.1:3001';
const SALES = process.env.OPERATOR_SALES_TOKEN ?? '';
const ADMIN = process.env.OPERATOR_ADMIN_TOKEN ?? '';
if (!SALES || !ADMIN) {
  console.error('TOKENS MANQUANTS (env conteneur requis).');
  process.exit(2);
}

const api = async (method, path, body, admin = false) => {
  const r = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${admin ? ADMIN : SALES}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  let data = null;
  try { data = JSON.parse(text); } catch { /* message brut */ }
  return { status: r.status, data, text: text.slice(0, 200) };
};

// --- Scénario : 6 clients fictifs, 7 tâches -------------------------------
// dueAt : délais relatifs en heures (négatif = échu, visible dashboard).
const NOW = Date.now();
const H = 3_600_000;
const TASKS = [
  { key: 't01', customer: 'DEMO-JURY-C01', name: 'Awa Koné — villa Cocody',
    kind: 'rfq_followup', priority: 'high',
    motive: '[DÉMO] Relance devis ciment et fer pour villa en fondations à Cocody.',
    dueH: -26, cancel: false },
  { key: 't02', customer: 'DEMO-JURY-C02', name: 'Yao Kouassi — toiture Yopougon',
    kind: 'quote_followup', priority: 'normal',
    motive: '[DÉMO] Devis tôles et charpente pour toiture à Yopougon, client pressé.',
    dueH: +30, cancel: false },
  { key: 't03', customer: 'DEMO-JURY-C03', name: 'Fatou Diallo — opposition',
    kind: 'project_checkin', priority: 'normal',
    motive: '[DÉMO] Suivi projet carrelage, cliente ayant demandé à ne plus être appelée.',
    dueH: -50, cancel: false },
  { key: 't04', customer: 'DEMO-JURY-C04', name: 'Ibrahim Touré — chantier terminé',
    kind: 'manual', priority: 'low',
    motive: '[DÉMO] Clôture dossier peinture et plomberie, chantier réceptionné.',
    dueH: +72, cancel: false },
  { key: 't05', customer: 'DEMO-JURY-C05', name: 'Mariam Diarra — report toiture',
    kind: 'rfq_followup', priority: 'high',
    motive: '[DÉMO] Report de toiture après intempéries, besoin aide conseiller.',
    dueH: -5, cancel: false },
  { key: 't06', customer: 'DEMO-JURY-C06', name: 'Sekou Camara — devis repris',
    kind: 'manual', priority: 'normal',
    motive: '[DÉMO] Devis gravier et sable repris après premier contact infructueux.',
    dueH: +20, cancel: false },
  { key: 't07', customer: 'DEMO-JURY-C01', name: 'Awa Koné — doublon annulé',
    kind: 'manual', priority: 'low',
    motive: '[DÉMO] Doublon de saisie détecté au comptoir, à annuler.',
    dueH: -10, cancel: true },
];

const CONSENTS = [
  { customer: 'DEMO-JURY-C01', status: 'granted' },
  { customer: 'DEMO-JURY-C02', status: 'granted' },
  { customer: 'DEMO-JURY-C04', status: 'granted' },
  { customer: 'DEMO-JURY-C05', status: 'granted' },
  { customer: 'DEMO-JURY-C06', status: 'withdrawn' },
  // C03 : opposition via opt-out dédié (refused).
];

// UUID stables pour la partie SQL (re-run sûr via ON CONFLICT DO NOTHING).
const ATTEMPTS = [
  { id: '11111111-1111-4111-8111-111111111111', task: 't01', claim: 'finished',
    outcome: 'no_answer', summary: '[DÉMO] Appel fictif sans réponse, répondeur muet.' },
  { id: '22222222-2222-4222-8222-222222222222', task: 't02', claim: 'started',
    outcome: null, summary: null, started: true },
  { id: '33333333-3333-4333-8333-333333333333', task: 't03', claim: 'finished',
    outcome: 'refused', summary: '[DÉMO] Cliente fictive : stop démarchage demandé.' },
  { id: '44444444-4444-4444-8444-444444444444', task: 't04', claim: 'finished',
    outcome: 'completed', summary: '[DÉMO] Dossier fictif clôturé, client satisfait.' },
  { id: '55555555-5555-4555-8555-555555555555', task: 't05', claim: 'started',
    outcome: null, summary: null, started: true },
  { id: '66666666-6666-4666-8666-666666666666', task: 't06', claim: 'finished',
    outcome: 'failed', summary: '[DÉMO] Ligne fictive coupée, à reprogrammer.' },
];

const ALLOW_EXAMPLE = {
  id: '99999999-9999-4999-8999-999999999999', task: 't02',
};

// --- Partie API : traçabilité réelle --------------------------------------
const summary = { created: [], skipped: [], info: [] };

async function seedConsents() {
  for (const c of CONSENTS) {
    const cur = await api('GET', `/api/v1/relance/consents/${c.customer}`);
    if (cur.data?.status === c.status) { summary.skipped.push(`consent ${c.customer}`); continue; }
    const r = await api('POST', '/api/v1/relance/consents',
      { customerRef: c.customer, status: c.status, source: 'operateur', proofRef: 'demo-jury-comptoir' });
    if (r.status !== 200 && r.status !== 201) throw new Error(`consent ${c.customer}: ${r.status} ${r.text}`);
    summary.created.push(`consent ${c.customer}=${c.status}`);
  }
  const cur3 = await api('GET', '/api/v1/relance/consents/DEMO-JURY-C03');
  if (cur3.data?.status !== 'refused') {
    const r = await api('POST', '/api/v1/relance/consents/opt-out',
      { customerRef: 'DEMO-JURY-C03', proofRef: 'demo-jury-comptoir' });
    if (r.status !== 200 && r.status !== 201) throw new Error(`opt-out C03: ${r.status} ${r.text}`);
    summary.created.push('consent DEMO-JURY-C03=refused');
  } else summary.skipped.push('consent DEMO-JURY-C03');
}

async function seedRfqNumber() {
  // RFQ mock déterministe (MOCK-<hash8> du contenu) : re-run sûr.
  // Écritures Core verrouillées : aucun appel externe, mock:true.
  const secret = process.env.VOICE_TOOL_SECRET ?? '';
  const r = await fetch(`${BASE}/api/v1/relance/tools/confirm-rfq`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-voice-tool-secret': secret },
    body: JSON.stringify({
      organizationId: 1,
      items: [{ label: 'Peinture vinylique 15 L', qty: 8, unit: 'pot' }],
      confirmationClient: true, idempotenceKey: 'demo-jury-rfq04',
    }),
  });
  const data = await r.json().catch(() => null);
  if ((r.status === 200 || r.status === 201) && data?.rfqNumber) {
    summary.info.push(`rfq mock ${data.rfqNumber} (déterministe, non persisté)`);
    return data.rfqNumber;
  }
  summary.skipped.push(`rfq mock (${r.status})`);
  return null;
}

async function seedTasks(rfqNumber) {
  const list = await api('GET', '/api/v1/relance/tasks?limit=200');
  const known = new Map((list.data ?? []).map((t) => [t.idempotencyKey, t]));
  const byKey = {};
  for (const t of TASKS) {
    const key = `demo-jury-${t.key}`;
    if (known.has(key)) { byKey[t.key] = known.get(key); summary.skipped.push(`task ${key}`); continue; }
    const r = await api('POST', '/api/v1/relance/tasks', {
      customerRef: t.customer, kind: t.kind, motive: t.motive, priority: t.priority,
      dueAt: new Date(NOW + t.dueH * H).toISOString(),
      nextAction: '[DÉMO] Recontacter au comptoir ou par message.',
      idempotencyKey: key,
      ...(t.key === 't04' && rfqNumber ? { coreRef: rfqNumber } : {}),
    });
    if (r.status !== 200 && r.status !== 201) throw new Error(`task ${key}: ${r.status} ${r.text}`);
    byKey[t.key] = r.data;
    summary.created.push(`task ${key} (${r.data.id.slice(0, 8)})`);
  }
  return byKey;
}

async function seedEvaluates(byKey) {
  for (const key of ['t01', 't02', 't03', 't04', 't05', 't06']) {
    const dec = await api('GET', `/api/v1/relance/tasks/${byKey[key].id}/decisions`);
    if ((dec.data ?? []).length > 0) { summary.skipped.push(`evaluate ${key}`); continue; }
    const verified = key === 't02' || key === 't04';
    const r = await api('POST', `/api/v1/relance/tasks/${byKey[key].id}/evaluate`,
      verified ? { identityVerified: true } : {});
    if (r.status !== 200 && r.status !== 201) throw new Error(`evaluate ${key}: ${r.status} ${r.text}`);
    summary.created.push(`evaluate ${key} -> ${r.data.allowed ? 'allow' : 'block'} [${r.data.reasonCodes.join(',')}]`);
  }
}

async function seedHandoffs(byKey) {
  const list = await api('GET', '/api/v1/relance/handoffs');
  const has = (ref, mark) => (list.data ?? []).some((h) => h.customerRef === ref && h.summary.includes(mark));
  if (!has('DEMO-JURY-C05', 'demo-jury-h05')) {
    const r = await api('POST', '/api/v1/relance/handoffs', {
      taskId: byKey.t05.id, customerRef: 'DEMO-JURY-C05',
      motive: 'Toiture à chiffrer après intempéries, besoin aide conseiller.',
      summary: '[DÉMO demo-jury-h05] Dossier à reprendre au comptoir.',
      priority: 'high',
    });
    if (r.status !== 200 && r.status !== 201) throw new Error(`handoff h05: ${r.status} ${r.text}`);
    summary.created.push('handoff h05 pending');
  } else summary.skipped.push('handoff h05');
  if (!has('DEMO-JURY-C06', 'demo-jury-h06')) {
    const r = await api('POST', '/api/v1/relance/handoffs', {
      taskId: byKey.t06.id, customerRef: 'DEMO-JURY-C06',
      motive: 'Devis gravier et sable à reprendre après échec de contact.',
      summary: '[DÉMO demo-jury-h06] Reprise traitée pendant la démo.',
    });
    if (r.status !== 200 && r.status !== 201) throw new Error(`handoff h06: ${r.status} ${r.text}`);
    const id = r.data.id;
    await api('POST', `/api/v1/relance/handoffs/${id}/claim`, {});
    await api('POST', `/api/v1/relance/handoffs/${id}/resolve`,
      { report: '[DÉMO] Client fictif recontacté au comptoir, devis relancé.' });
    summary.created.push('handoff h06 resolved');
  } else summary.skipped.push('handoff h06');
}

async function seedLists() {
  // Pas d'endpoint de liste : l'existence est vérifiée en SQL (created_by).
  const need = await missingLists(['DEMO-JURY-C01', 'DEMO-JURY-C02']);
  if (need.includes('DEMO-JURY-C01')) {
    const r = await api('POST', '/api/v1/relance/material-lists', {
      customerRef: 'DEMO-JURY-C01', projectRef: 'demo-jury-villa-cocody',
      items: [
        { variantId: 9001, label: 'Ciment usage général sac 50 kg', qty: 40, unit: 'sac' },
        { label: 'Fer à béton diamètre 12', qty: 25, unit: 'barre' },
        { label: 'Sable lagunaire', qty: 3, unit: 'm3' },
      ],
    });
    if (r.status !== 200 && r.status !== 201) throw new Error(`liste C01: ${r.status} ${r.text}`);
    summary.created.push('liste C01 draft (1 résolue, 2 libres)');
  } else summary.skipped.push('liste C01');
  if (need.includes('DEMO-JURY-C02')) {
    const r = await api('POST', '/api/v1/relance/material-lists', {
      customerRef: 'DEMO-JURY-C02', projectRef: 'demo-jury-toiture-yopougon',
      items: [
        { variantId: 9002, label: 'Tôle bac alu 3 m', qty: 60, unit: 'feuille' },
        { label: 'Chevron bois rouge 5x7', qty: 30, unit: 'pièce' },
      ],
    });
    if (r.status !== 200 && r.status !== 201) throw new Error(`liste C02: ${r.status} ${r.text}`);
    const c = await api('POST', `/api/v1/relance/material-lists/${r.data.id}/confirm`, {});
    if (c.status !== 200 && c.status !== 201) throw new Error(`confirm C02: ${c.status} ${c.text}`);
    summary.created.push('liste C02 confirmed (1 résolue, 1 libre)');
  } else summary.skipped.push('liste C02');
}

// --- Partie SQL : attempts + transitions + 1 allow d'exemple --------------
// Pas d'endpoint de réservation : insertion directe, FK respectées,
// UUID stables + ON CONFLICT DO NOTHING, mises à jour conditionnelles
// (seulement si la tâche est encore dans l'état attendu du scénario).
let pool = null;
const db = () => {
  if (!pool) {
    pool = new pg.Pool({
      host: process.env.DB_HOST ?? '127.0.0.1',
      port: Number(process.env.DB_PORT ?? 5432),
      user: process.env.DB_USER ?? 'blok_relance',
      password: process.env.DB_PASSWORD ?? '',
      database: process.env.DB_NAME ?? 'blok_relance',
    });
  }
  return pool;
};

async function missingLists(refs) {
  const { rows } = await db().query(
    'SELECT DISTINCT customer_ref FROM material_lists WHERE customer_ref = ANY($1)',
    [refs],
  );
  const have = new Set(rows.map((r) => r.customer_ref));
  return refs.filter((r) => !have.has(r));
}

async function seedSql(byKey) {
  const client = await db().connect();
  try {
    await client.query('BEGIN');
    const ids = {};
    for (const [k, t] of Object.entries(byKey)) ids[k] = t.id;
    // 1. Tentatives (UUID stables, rejouables).
    for (const a of ATTEMPTS) {
      await client.query(
        `INSERT INTO call_attempts
           (id, task_id, claim_status, started_at, finished_at, outcome, summary)
         VALUES ($1, $2, $3::varchar,
           CASE WHEN $4 THEN now() ELSE NULL END,
           CASE WHEN $3::varchar = 'finished' THEN now() ELSE NULL END,
           $5::varchar, $6)
         ON CONFLICT (id) DO NOTHING`,
        [a.id, ids[a.task], a.claim, a.started ?? false, a.outcome, a.summary],
      );
    }
    // 2. Transitions associées (chaînes légales du service, si état attendu).
    await client.query(
      `UPDATE outreach_tasks SET status='in_progress', attempt_count=attempt_count+1,
         claimed_by='seed:demo-jury', updated_at=now()
       WHERE idempotency_key IN ('demo-jury-t02','demo-jury-t05')
         AND status='pending' AND attempt_count=0`);
    await client.query(
      `UPDATE outreach_tasks SET status='blocked', updated_at=now()
       WHERE idempotency_key='demo-jury-t03' AND status='pending'`);
    await client.query(
      `UPDATE outreach_tasks SET status='done', updated_at=now()
       WHERE idempotency_key='demo-jury-t04' AND status='pending'`);
    // t05 : chaîne complète vers awaiting_human (pending->claimed->in_progress
    // appliquée ci-dessus, puis in_progress->awaiting_human légale).
    await client.query(
      `UPDATE outreach_tasks SET status='awaiting_human', updated_at=now()
       WHERE idempotency_key='demo-jury-t05' AND status='in_progress'`);
    // 3. Une décision `allow` d'exemple (moteur en mock bloque toujours :
    // CORE_UNAVAILABLE + TELEPHONY_DISABLED ; marquée seed, ELIGIBLE réel).
    await client.query(
      `INSERT INTO decision_logs
         (id, task_id, decision, evaluated_at, rule_version, reason_codes,
          facts, requested_by)
       VALUES ($1, $2, 'allow', now(), 'v1.0.0', ARRAY['ELIGIBLE'],
          '{"demo":true,"note":"Exemple seedé : le moteur en mock bloque toujours"}',
          'seed:demo-jury')
       ON CONFLICT (id) DO NOTHING`,
      [ALLOW_EXAMPLE.id, ids[ALLOW_EXAMPLE.task]],
    );
    await client.query('COMMIT');
    // Transaction rejouée à chaque run (INSERT … ON CONFLICT DO NOTHING +
    // UPDATE conditionnels) : aucune ligne ajoutée au-delà du 1er passage.
    summary.info.push('sql: attempts + transitions + 1 allow (transaction rejouable)');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function seedFinal(byKey) {
  // Priorité haute déjà posée à la création (t01) ; annulation du doublon.
  const t7 = await api('GET', `/api/v1/relance/tasks/${byKey.t07.id}`);
  if (t7.data?.status === 'pending') {
    const r = await api('POST', `/api/v1/relance/tasks/${byKey.t07.id}/cancel`, {});
    if (r.status !== 200 && r.status !== 201) throw new Error(`cancel t07: ${r.status} ${r.text}`);
    summary.created.push('task demo-jury-t07 cancelled');
  } else summary.skipped.push('task demo-jury-t07');
}

async function main() {
  const rfq = await seedRfqNumber();
  await seedConsents();
  const byKey = await seedTasks(rfq);
  await seedEvaluates(byKey);
  await seedHandoffs(byKey);
  await seedLists();
  await seedSql(byKey);
  await seedFinal(byKey);
  await db().end();
  console.log('=== SEED DEMO-JURY ===');
  for (const c of summary.created) console.log(' +', c);
  for (const s of summary.skipped) console.log(' =', s);
  for (const i of summary.info) console.log(' i', i);
  console.log(`TOTAL: ${summary.created.length} créés, ${summary.skipped.length} déjà présents.`);
}

main().catch((e) => { console.error('SEED ÉCHEC:', e.message); process.exit(1); });
