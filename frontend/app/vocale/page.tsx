import { redirect } from "next/navigation";
import { callBackend } from "@/lib/backend";

async function demarrerSession(formData: FormData): Promise<void> {
  "use server";
  const customerRef = String(formData.get("customerRef") ?? "").trim();
  const res = await callBackend<{ id: string }>("/api/v1/relance/voice-sessions", {
    method: "POST",
    body: customerRef ? { customerRef } : {},
  });
  if (!res.ok) {
    throw new Error(`Session impossible (HTTP ${res.status}).`);
  }
  redirect(`/vocale/${res.data.id}`);
}

export default function Vocale() {
  return (
    <div>
      <h1>Parler à ESTHER</h1>
      <p className="muted">
        Expérience vocale immersive : ESTHER vous accueille, consulte le catalogue BLOK pendant
        l’échange et prépare votre devis. Le récapitulatif classique reste disponible sur la page{" "}
        <a href="/conversation">Conversation</a>.
      </p>
      <div className="card">
        <form action={demarrerSession} className="inline">
          <label>
            <span>Référence client (optionnel)</span>
            <input name="customerRef" maxLength={128} placeholder="ex. DEMO-JURY-C01" />
          </label>
          <button type="submit">Démarrer avec ESTHER</button>
        </form>
      </div>
      <div className="card">
        <h2>Avant de commencer</h2>
        <ul>
          <li>Autorisez le microphone quand le navigateur le demande.</li>
          <li>Parlez naturellement en français, dans un endroit calme.</li>
          <li>
            Le serveur vocal doit tourner (<code>blok_voice/agent/server.py</code>, port 5000).
          </li>
        </ul>
      </div>
    </div>
  );
}
