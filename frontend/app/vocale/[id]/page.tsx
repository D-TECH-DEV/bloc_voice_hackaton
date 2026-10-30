import { EstherExperience } from "@/components/esther/EstherExperience";
import "../esther.css";

/**
 * Expérience vocale immersive (orb, contrôles, panier, devis).
 * L'URL du proxy vocal reste côté serveur : le navigateur ne voit que
 * l'hôte du proxy, jamais les clés ni les jetons (relais same-origin).
 */
export default async function VocaleSession({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const voiceBaseUrl = process.env.VOICE_URL ?? "http://127.0.0.1:5000";
  return (
    <div>
      <h1>
        ESTHER — <code>{id}</code>
      </h1>
      <EstherExperience sessionId={id} voiceBaseUrl={voiceBaseUrl} />
    </div>
  );
}
