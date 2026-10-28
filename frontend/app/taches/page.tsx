import { revalidatePath } from "next/cache";
import { callBackend } from "@/lib/backend";

interface Task {
  id: string;
  customerRef: string;
  status: string;
  priority: string;
  kind: string;
  dueAt: string;
  motive: string;
  attemptCount: number;
}

const STATUTS = ["pending", "claimed", "in_progress", "done", "cancelled", "blocked", "awaiting_human"];

async function createTask(formData: FormData): Promise<void> {
  "use server";
  await callBackend("/api/v1/relance/tasks", {
    method: "POST",
    body: {
      customerRef: String(formData.get("customerRef") ?? "").trim(),
      kind: String(formData.get("kind") ?? "manual"),
      motive: String(formData.get("motive") ?? ""),
      dueAt: new Date(String(formData.get("dueAt") ?? Date.now())).toISOString(),
      idempotencyKey: String(formData.get("idempotencyKey") ?? crypto.randomUUID()),
    },
  });
  revalidatePath("/taches");
}

export default async function Taches({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const res = await callBackend<Task[]>(
    `/api/v1/relance/tasks${status ? `?status=${encodeURIComponent(status)}` : ""}`,
  );
  return (
    <div>
      <h1>File de tâches</h1>
      {!res.ok ? (
        <div className="error" role="alert">
          File indisponible : {(res.data as { message?: string }).message ?? `HTTP ${res.status}`}.
        </div>
      ) : res.data.length === 0 ? (
        <div className="empty">Aucune tâche{status ? ` au statut « ${status} »` : ""}.</div>
      ) : (
        <div className="card">
          <form method="get" className="inline">
            <label>Statut
              <select name="status" defaultValue={status ?? ""}>
                <option value="">Tous</option>
                {STATUTS.map((s) => (<option key={s} value={s}>{s}</option>))}
              </select>
            </label>
            <button className="secondary" type="submit">Filtrer</button>
          </form>
          <table>
            <thead><tr><th>Client</th><th>Statut</th><th>Priorité</th><th>Échéance</th><th>Tentatives</th><th></th></tr></thead>
            <tbody>
              {res.data.map((t) => (
                <tr key={t.id}>
                  <td><code>{t.customerRef}</code></td>
                  <td><span className={`pill ${t.status}`}>{t.status}</span></td>
                  <td>{t.priority}</td>
                  <td>{new Date(t.dueAt).toLocaleString("fr-FR")}</td>
                  <td>{t.attemptCount}</td>
                  <td><a href={`/taches/${t.id}`}>Ouvrir</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <h2>Créer une tâche (manuelle)</h2>
      <div className="card">
        <form action={createTask} className="inline">
          <label>Référence client<input name="customerRef" required maxLength={128} /></label>
          <label>Type
            <select name="kind" defaultValue="manual">
              <option value="manual">manual</option>
              <option value="rfq_followup">rfq_followup</option>
              <option value="quote_followup">quote_followup</option>
              <option value="project_checkin">project_checkin</option>
            </select>
          </label>
          <label>Motif (≥ 10 caractères)<input name="motive" required minLength={10} /></label>
          <label>Échéance<input name="dueAt" type="datetime-local" required /></label>
          <button type="submit">Créer</button>
        </form>
        <p className="muted">Créer une tâche ne déclenche aucun appel. L’éligibilité est réévaluée avant toute tentative.</p>
      </div>
    </div>
  );
}
