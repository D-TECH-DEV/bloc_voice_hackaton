import { callBackend } from "@/lib/backend";

interface Decision {
  id: string;
  taskId: string | null;
  decision: string;
  reasonCodes: string[];
  ruleVersion: string;
  evaluatedAt: string;
  requestedBy: string;
}

export default async function Decisions() {
  const res = await callBackend<Decision[]>("/api/v1/admin/decisions?limit=200", { admin: true });
  return (
    <div>
      <h1>Journal des décisions</h1>
      {!res.ok ? (
        res.status === 403 ? (
          <div className="empty">Accès réservé au rôle admin. Configurez <code>OPERATOR_ADMIN_TOKEN</code> côté serveur.</div>
        ) : (
          <div className="error" role="alert">Journal indisponible : {(res.data as { message?: string }).message ?? `HTTP ${res.status}`}.</div>
        )
      ) : res.data.length === 0 ? (
        <div className="empty">Aucune décision journalisée.</div>
      ) : (
        <div className="card"><table>
          <thead><tr><th>Date</th><th>Tâche</th><th>Décision</th><th>Motifs</th><th>Règles</th><th>Demandé par</th></tr></thead>
          <tbody>{res.data.map((d) => (
            <tr key={d.id}>
              <td>{new Date(d.evaluatedAt).toLocaleString("fr-FR")}</td>
              <td>{d.taskId ? <a href={`/taches/${d.taskId}`}>{d.taskId.slice(0, 8)}…</a> : "—"}</td>
              <td>{d.decision}</td>
              <td>{d.reasonCodes.join(", ")}</td>
              <td>{d.ruleVersion}</td>
              <td>{d.requestedBy}</td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
      <p className="muted">Journal immuable : les blocages y figurent au même titre que les autorisations.</p>
    </div>
  );
}
