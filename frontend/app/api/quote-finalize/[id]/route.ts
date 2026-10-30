import { NextResponse } from "next/server";
import { callBackend } from "@/lib/backend";
import type { DevisPret } from "@/lib/recap";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Relais same-origin de la finalisation du devis (idempotent côté backend :
 * les clics répétés renvoient le devis existant, sans doublon).
 * Le jeton opérateur reste côté serveur.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ message: "Identifiant de session invalide." }, { status: 400 });
  }
  const devis = await callBackend<DevisPret>(`/api/v1/relance/quotes/from-session`, {
    method: "POST",
    body: { sessionId: id },
  });
  return NextResponse.json(devis.data, { status: devis.status });
}
