import { revalidatePath } from "next/cache";
import { callBackend } from "@/lib/backend";

interface Handoff {
  id: string;
  customerRef: string;
  motive: string;
  summary: string;
  priority: string;
  status: string;
  claimedBy: string | null;
  claimReport: string | null;
  createdAt: string;
}

async function claim(id: string): Promise<void> {
  "use server";
  await callBackend(`/api/v1/relance/handoffs/${id}/claim`, { method: "POST" });
  revalidatePath("/transferts");
}

async function resolve(id: string, formData: FormData): Promise<void> {
  "use server";
  await callBackend(`/api/v1/relance/handoffs/${id}/resolve`, {
    method: "POST",
    body: { report: String(formData.get("report") ?? "") },
  });
  revalidatePath("/transferts");
}

export default async function Transferts() {
  const res = await callBackend<Handoff[]>("/api/v1/relance/handoffs");
  return (
    <div>
      <h1>Transferts commerciaux</h1>
      {!res.ok ? (
        <div className="error" role="alert">Liste indisponible : {(res.data as { message?: string }).message ?? `HTTP ${res.status}`}.</div>
      ) : res.data.length === 0 ? (
        <div className="empty">Aucun dossier en transfert.</div>
      ) : (
        res.data.map((h) => (
          <div className="card" key={h.id}>
            <p><code>{h.customerRef}</code> · <span className={`pill ${h.status}`}>{h.status}</span> · priorité {h.priority}</p>
            <p>Motif : {h.motive}</p>
            <p className="muted">{h.summary}</p>
            <p className="muted">Pris en charge par : {h.claimedBy ?? "personne"} · Compte rendu : {h.claimReport ?? "—"}</p>
            {h.status === "pending" && (
              <form action={claim.bind(null, h.id)}><button type="submit">Prendre en charge</button></form>
            )}
            {h.status === "claimed" && (
              <form action={resolve.bind(null, h.id)} className="inline">
                <label>Compte rendu<textarea name="report" required /></label>
                <button type="submit">Clôturer</button>
              </form>
            )}
          </div>
        ))
      )}
    </div>
  );
}
