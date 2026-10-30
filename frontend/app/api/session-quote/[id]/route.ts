import { NextResponse } from "next/server";
import { callBackend } from "@/lib/backend";
import type { EtatDevis } from "@/lib/recap";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Relais same-origin de l'état du devis d'une session.
 * Le jeton opérateur reste côté serveur. 200 + { pret: false }
 * tant que le devis n'est pas finalisé (scruté par RecapLive).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ message: "Identifiant de session invalide." }, { status: 400 });
  }
  const devis = await callBackend<EtatDevis>(`/api/v1/relance/quotes/by-session/${id}`);
  return NextResponse.json(devis.data, { status: devis.status });
}
