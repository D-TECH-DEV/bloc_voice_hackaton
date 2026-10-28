import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { searchBlokProducts, BlokApiError } from "@/lib/blok";

const RechercherProduitSchema = z.object({
  terme: z
    .string({
      required_error: "Le champ 'terme' est obligatoire.",
      invalid_type_error: "Le champ 'terme' doit être une chaîne de caractères.",
    })
    .trim()
    .min(1, "Le terme de recherche ne peut pas être vide."),
});

export interface ProduitVocale {
  id: string | number;
  nom: string;
  prix: number | null;
  unite: string;
  disponible: boolean;
}

interface BlokRawItem {
  id?: string | number;
  name?: string;
  nom?: string;
  title?: string;
  designation?: string;
  label?: string;
  price?: number | string | null;
  prix?: number | string | null;
  unit_price?: number | string | null;
  unit?: string | null;
  unite?: string | null;
  packaging?: string | null;
  uom?: string | null;
  is_available?: boolean | null;
  disponible?: boolean | null;
  available?: boolean | null;
  stock?: number | null;
  quantity?: number | null;
  status?: string | null;
  [key: string]: unknown;
}

function mapBlokItemToProduit(item: BlokRawItem, index: number): ProduitVocale {
  const id = item.id ?? `prod-${index + 1}`;
  const nom = (item.name || item.nom || item.title || item.designation || item.label || "Matériau standard").toString();

  let rawPrice = item.price ?? item.prix ?? item.unit_price;
  let prix: number | null = null;
  if (typeof rawPrice === "number") {
    prix = rawPrice;
  } else if (typeof rawPrice === "string") {
    const parsed = parseFloat(rawPrice);
    prix = isNaN(parsed) ? null : parsed;
  }

  const unite = (item.unit || item.unite || item.packaging || item.uom || "unité").toString();

  let disponible = true;
  if (typeof item.available === "boolean") {
    disponible = item.available;
  } else if (typeof item.is_available === "boolean") {
    disponible = item.is_available;
  } else if (typeof item.disponible === "boolean") {
    disponible = item.disponible;
  } else if (typeof item.stock === "number") {
    disponible = item.stock > 0;
  } else if (typeof item.quantity === "number") {
    disponible = item.quantity > 0;
  } else if (typeof item.status === "string") {
    disponible = !["inactive", "out_of_stock", "disabled", "epuise"].includes(item.status.toLowerCase());
  }

  return { id, nom, prix, unite, disponible };
}

function genererMessageVocal(terme: string, produits: ProduitVocale[]): string {
  if (produits.length === 0) {
    return `Aucun produit correspondant à "${terme}" n'a été trouvé dans le catalogue Blok.`;
  }

  if (produits.length === 1) {
    const p = produits[0];
    const prixTxt = p.prix !== null ? `à ${p.prix.toLocaleString("fr-FR")} francs CFA l'unité (${p.unite})` : "prix sur demande";
    const dispoTxt = p.disponible ? "disponible" : "actuellement indisponible";
    return `J'ai trouvé : ${p.nom}, ${prixTxt}, ${dispoTxt}.`;
  }

  const p1 = produits[0];
  const prixTxt1 = p1.prix !== null ? `à ${p1.prix.toLocaleString("fr-FR")} francs CFA` : "sur demande";
  return `J'ai trouvé ${produits.length} options pour "${terme}". Le premier résultat est ${p1.nom} ${prixTxt1}. Souhaitez-vous d'autres détails ?`;
}

export async function POST(request: NextRequest) {
  const sharedSecret = process.env.AGENT_SHARED_SECRET?.trim();
  const incomingSecret = request.headers.get("x-agent-secret")?.trim();

  if (!sharedSecret) {
    return NextResponse.json(
      { error: "Configuration serveur incomplète : AGENT_SHARED_SECRET n'est pas configuré." },
      { status: 500 }
    );
  }

  if (!incomingSecret || incomingSecret !== sharedSecret) {
    return NextResponse.json(
      { error: "Accès refusé : en-tête x-agent-secret manquant ou invalide." },
      { status: 401 }
    );
  }

  let bodyJson: unknown;
  try {
    bodyJson = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Corps de requête invalide : JSON attendu." },
      { status: 400 }
    );
  }

  const parseResult = RechercherProduitSchema.safeParse(bodyJson);
  if (!parseResult.success) {
    const errorDetails = parseResult.error.issues.map((i) => i.message).join(" ");
    return NextResponse.json(
      { error: "Validation échouée", details: errorDetails },
      { status: 400 }
    );
  }

  const { terme } = parseResult.data;

  try {
    const { data: rawItems, isMock } = await searchBlokProducts(terme, 5);
    const produits = (rawItems as BlokRawItem[]).slice(0, 5).map((item, idx) => mapBlokItemToProduit(item, idx));
    const message = genererMessageVocal(terme, produits);

    return NextResponse.json({
      produits,
      message,
      ...(isMock ? { simulation: true } : {}),
    });
  } catch (err: unknown) {
    if (err instanceof BlokApiError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status || 502 }
      );
    }

    const genericMsg = err instanceof Error ? err.message : "Erreur interne";
    return NextResponse.json(
      { error: "Une erreur inattendue est survenue lors de la recherche.", details: genericMsg },
      { status: 500 }
    );
  }
}
