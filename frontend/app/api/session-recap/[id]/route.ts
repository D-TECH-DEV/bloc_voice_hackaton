import { NextResponse } from "next/server";
import { callBackend } from "@/lib/backend";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Relais same-origin du récapitulatif de conversation.
 * Le jeton opérateur reste côté serveur : le navigateur n'en voit jamais.
 * Interrogé pendant l'appel (rafraîchissement) et à la fin (reconnexion = re-GET).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ message: "Identifiant de session invalide." }, { status: 400 });
  }
  const recap = await callBackend(`/api/v1/relance/voice-sessions/${id}/recap`);
  return NextResponse.json(recap.data, { status: recap.status });
}
