import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { callBackend } from "@/lib/backend";

interface TaskDetail {
  id: string;
  customerRef: string;
  organizationId: number | null;
  kind: string;
  motive: string;
  coreRef: string | null;
  status: string;
  priority: string;
  dueAt: string;
  nextAction: string | null;
  attemptCount: number;
  lastEvaluation: { allowed?: boolean; reasonCodes?: string[]; ruleVersion?: string } | null;
}
interface Attempt {
  id: string;
  claimStatus: string;
  outcome: string | null;
  summary: string | null;
  createdAt: string;
}
interface Decision {
  id: string;
  decision: string;
  reasonCodes: string[];
  ruleVersion: string;
  evaluatedAt: string;
  requestedBy: string;
}

async function cancelTask(id: string): Promise<void> {
  "use server";
  await callBackend(`/api/v1/relance/tasks/${id}/cancel`, { method: "POST" });
  revalidatePath(`/taches/${id}`);
}

async function evaluateTask(id: string, formData: FormData): Promise<void> {
  "use server";
  await callBackend(`/api/v1/relance/tasks/${id}/evaluate`, {
    method: "POST",
    body: { identityVerified: formData.get("identityVerified") === "on" },
  });
  revalidatePath(`/taches/${id}`);
}

export default async function FicheTache({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [task, attempts, decisions, consent] = await Promise.all([
    callBackend<TaskDetail>(`/api/v1/relance/tasks/${id}`),
    callBackend<Attempt[]>(`/api/v1/relance/tasks/${id}/attempts`),
    callBackend<Decision[]>(`/api/v1/relance/tasks/${id}/decisions`),
    callBackend<{ status?: string }>(`/api/v1/relance/tasks/${id}`).then(async (t) =>
      t.ok
        ? callBackend<{ status?: string }>(
            `/api/v1/relance/consents/${encodeURIComponent((t.data as TaskDetail).customerRef)}`,
          )
        : { ok: false as const, status: 0, data: {} },
    ),
  ]);
  if (!task.ok) notFound();
  const t = task.data;
  return (
    <div>
      <h1>Fiche de suivi — <code>{t.customerRef}</code></h1>
      <div className="card">
        <p>Statut : <span className={`pill ${t.status}`}>{t.status}</span> · Priorité : {t.priority} · Type : {t.kind}</p>
        <p>Motif : {t.motive}</p>
        <p className="muted">Référence Core : {t.coreRef ?? "non connue"} · Échéance : {new Date(t.dueAt).toLocaleString("fr-FR")} · Tentatives : {t.attemptCount}</p>
        <p>Consentement vocal : <strong>{consent.ok ? (consent.data.status ?? "inconnu") : "non vérifié"}</strong></p>
        {t.lastEvaluation && (
          <div>
            <h2>Dernière évaluation</h2>
            <p>Autorisé : <strong>{t.lastEvaluation.allowed ? "oui" : "non"}</strong> · Règles : {t.lastEvaluation.ruleVersion}</p>
            <p className="muted">{(t.lastEvaluation.reasonCodes ?? []).join(", ")}</p>
          </div>
        )}
        <form action={evaluateTask.bind(null, id)} className="inline">
          <label><span><input type="checkbox" name="identityVerified" /> Identité et numéro vérifiés (source fiable)</span></label>
          <button className="secondary" type="submit">Réévaluer l’éligibilité</button>
        </form>
        <form action={cancelTask.bind(null, id)} className="inline">
          <button className="danger" type="submit">Annuler la tâche</button>
        </form>
      </div>
      <h2>Tentatives ({attempts.ok ? attempts.data.length : "?"})</h2>
      {!attempts.ok || attempts.data.length === 0 ? (
        <div className="empty">Aucune tentative enregistrée.</div>
      ) : (
        <div className="card"><table>
          <thead><tr><th>Date</th><th>État</th><th>Résultat</th><th>Résumé</th></tr></thead>
          <tbody>{attempts.data.map((a) => (
            <tr key={a.id}><td>{new Date(a.createdAt).toLocaleString("fr-FR")}</td><td>{a.claimStatus}</td><td>{a.outcome ?? "inconnu"}</td><td>{a.summary ?? "—"}</td></tr>
          ))}</tbody>
        </table></div>
      )}
      <h2>Journal des décisions</h2>
      {!decisions.ok || decisions.data.length === 0 ? (
        <div className="empty">Aucune décision journalisée pour cette tâche.</div>
      ) : (
        <div className="card"><table>
          <thead><tr><th>Date</th><th>Décision</th><th>Motifs</th><th>Règles</th><th>Demandé par</th></tr></thead>
          <tbody>{decisions.data.map((d) => (
            <tr key={d.id}><td>{new Date(d.evaluatedAt).toLocaleString("fr-FR")}</td><td>{d.decision}</td><td>{d.reasonCodes.join(", ")}</td><td>{d.ruleVersion}</td><td>{d.requestedBy}</td></tr>
          ))}</tbody>
        </table></div>
      )}
    </div>
  );
}
