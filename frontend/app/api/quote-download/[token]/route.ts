import { NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_URL ?? "http://127.0.0.1:3001";
const TOKEN_RE = /^[0-9a-f]{64}$/i;

/**
 * Relais same-origin du téléchargement PDF.
 * Le jeton de téléchargement (imprédictible) est la seule clé d'accès :
 * format invalide ou inconnu → 404 uniforme (aucun oracle).
 * Le jeton opérateur n'est jamais exposé (route backend publique).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!TOKEN_RE.test(token)) {
    return NextResponse.json({ message: "Devis introuvable." }, { status: 404 });
  }
  let res: Response;
  try {
    res = await fetch(`${BACKEND}/api/v1/relance/quotes/download/${token}`, { cache: "no-store" });
  } catch {
    return NextResponse.json({ message: "Backend injoignable." }, { status: 502 });
  }
  if (!res.ok) {
    return NextResponse.json({ message: "Devis introuvable." }, { status: 404 });
  }
  const pdf = await res.arrayBuffer();
  const disposition = res.headers.get("content-disposition") ?? "attachment; filename=\"devis.pdf\"";
  return new NextResponse(pdf, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": disposition,
      "Content-Length": String(pdf.byteLength),
    },
  });
}
