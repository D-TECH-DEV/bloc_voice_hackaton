import { revalidatePath } from "next/cache";
import { callBackend } from "@/lib/backend";

async function optOut(formData: FormData): Promise<void> {
  "use server";
  await callBackend("/api/v1/relance/consents/opt-out", {
    method: "POST",
    body: { customerRef: String(formData.get("customerRef") ?? "").trim() },
  });
  revalidatePath("/consents");
}

export default async function Consents({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;
  const status = ref
    ? await callBackend<{ status?: string }>(`/api/v1/relance/consents/${encodeURIComponent(ref)}`)
    : null;
  return (
    <div>
      <h1>Consentements vocaux</h1>
      <div className="card">
        <form action="/consents" className="inline" method="get">
          <label>Référence client<input name="ref" defaultValue={ref ?? ""} required /></label>
          <button className="secondary" type="submit">Consulter</button>
        </form>
        {ref && status && (
          <p>Statut de <code>{ref}</code> :{" "}
            <span className={`pill ${status.ok ? (status.data.status ?? "") : ""}`}>
              {status.ok ? (status.data.status ?? "inconnu") : "non vérifié"}
            </span>
          </p>
        )}
        <p className="muted">Absence de fiche = consentement inconnu = appel bloqué. Une opposition prime sur toute tâche.</p>
      </div>
      <h2>Enregistrer une opposition</h2>
      <div className="card">
        <form action={optOut} className="inline">
          <label>Référence client<input name="customerRef" required maxLength={128} /></label>
          <button className="danger" type="submit">Enregistrer l’opposition (effet immédiat)</button>
        </form>
      </div>
    </div>
  );
}
