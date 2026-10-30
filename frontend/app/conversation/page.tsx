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
  redirect(`/conversation/${res.data.id}`);
}

export default function Conversation() {
  return (
    <div>
      <h1>Conversation vocale — catalogue BLOK</h1>
      <p className="muted">
        Créez le contexte d’une conversation avec ESTHER, puis ouvrez le client vocal. Les produits que
        l’agente récupère et propose s’affichent ici pendant l’appel ; le récapitulatif fidèle reste
        disponible après la fin de la conversation.
      </p>
      <div className="card">
        <form action={demarrerSession} className="inline">
          <label>
            <span>Référence client (optionnel)</span>
            <input name="customerRef" maxLength={128} placeholder="ex. DEMO-JURY-C01" />
          </label>
          <button type="submit">Démarrer une session</button>
        </form>
      </div>
      <div className="card">
        <h2>Déroulé</h2>
        <ol>
          <li>Démarrez la session ci-dessus et notez son identifiant.</li>
          <li>
            Ouvrez le client vocal (<code>http://127.0.0.1:5000/</code>) et parlez à ESTHER en français.
          </li>
          <li>
            Transmettez l’identifiant de session à l’agente au début de l’échange (ou configurez-le dans
            l’outil) pour rattacher recherches et recommandations à cette page.
          </li>
          <li>Suivez les produits proposés ici en temps réel, puis le récapitulatif à la fin de l’appel.</li>
        </ol>
        <p className="muted">
          WebRTC transporte uniquement la voix. Cette page interroge le backend en HTTP : aucune donnée
          produit ne transite par le navigateur autrement que via ce relais serveur.
        </p>
      </div>
    </div>
  );
}
