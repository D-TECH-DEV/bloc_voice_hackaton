import { callBackend } from "@/lib/backend";

interface Task {
  id: string;
  customerRef: string;
  status: string;
  priority: string;
  kind: string;
  dueAt: string;
  attemptCount: number;
}
interface Handoff {
  id: string;
  status: string;
}
interface Decision {
  decision: string;
  reasonCodes: string[];
}

function count<T>(items: T[], pred: (t: T) => boolean): number {
  return items.filter(pred).length;
}

export default async function Dashboard() {
  const [tasks, handoffs, decisions] = await Promise.all([
    callBackend<Task[]>("/api/v1/relance/tasks?limit=200"),
    callBackend<Handoff[]>("/api/v1/relance/handoffs"),
    callBackend<Decision[]>("/api/v1/admin/decisions?limit=200", { admin: true }),
  ]);
  if (!tasks.ok) {
    return (
      <div>
        <h1>Tableau de bord</h1>
        <div className="error" role="alert">
          Données indisponibles : {(tasks.data as { message?: string }).message ?? `HTTP ${tasks.status}`}.
          Vérifiez que le backend est démarré et que le jeton est configuré.
        </div>
      </div>
    );
  }
  const list = tasks.data;
  const hs = handoffs.ok ? handoffs.data : [];
  const blocks = decisions.ok
    ? decisions.data.filter((d) => d.decision === "block").length
    : null;
  return (
    <div>
      <h1>Tableau de bord</h1>
      <p className="muted">Indicateurs calculés sur les données réellement présentes. Aucun score ni taux de conversion affiché.</p>
      <div className="grid">
        <div className="stat"><div className="n">{count(list, (t) => t.status === "pending")}</div><div className="l">Tâches en attente</div></div>
        <div className="stat"><div className="n">{count(list, (t) => t.status === "blocked")}</div><div className="l">Tâches bloquées</div></div>
        <div className="stat"><div className="n">{count(list, (t) => t.status === "awaiting_human")}</div><div className="l">En attente humaine</div></div>
        <div className="stat"><div className="n">{count(hs, (h) => h.status === "pending")}</div><div className="l">Dossiers à reprendre</div></div>
        <div className="stat"><div className="n">{blocks ?? "—"}</div><div className="l">Blocages journalisés{blocks === null ? " (admin requis)" : ""}</div></div>
      </div>
      <h2>Tâches échues en attente</h2>
      {list.filter((t) => t.status === "pending" && new Date(t.dueAt) <= new Date()).length === 0 ? (
        <div className="empty">Aucune tâche échue en attente.</div>
      ) : (
        <div className="card">
          <table>
            <thead><tr><th>Client</th><th>Motif</th><th>Échéance</th><th></th></tr></thead>
            <tbody>
              {list.filter((t) => t.status === "pending" && new Date(t.dueAt) <= new Date()).map((t) => (
                <tr key={t.id}>
                  <td><code>{t.customerRef}</code></td>
                  <td>{t.kind}</td>
                  <td>{new Date(t.dueAt).toLocaleString("fr-FR")}</td>
                  <td><a href={`/taches/${t.id}`}>Ouvrir</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
