import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createBlokRfq, isWritesEnabled, isMockMode, BlokApiError } from "@/lib/blok";

// Schéma de validation pour une ligne d'article
const LigneArticleSchema = z.object({
  produit_id: z.union([z.string(), z.number()]).optional(),
  designation: z.string().trim().min(1, "La désignation du produit est obligatoire."),
  quantite: z.number().int().positive("La quantité doit être un entier supérieur à 0."),
  prix_unitaire: z.number().positive("Le prix unitaire doit être positif.").optional(),
});

// Schéma de validation de la préparation de devis
const PreparerDevisSchema = z.object({
  client_id: z.union([z.string(), z.number()]).optional(),
  organization_id: z.number().int().positive().optional().default(42),
  articles: z
    .array(LigneArticleSchema)
    .min(1, "Le devis doit contenir au moins un article."),
});

function genererMessageVocalDevis(
  articles: Array<{ designation: string; quantite: number }>,
  totalEstime: number | null
): string {
  const nbArticles = articles.length;
  const premier = articles[0];
  const resumeArticles = nbArticles === 1
    ? `${premier.quantite} ${premier.designation}`
    : `${premier.quantite} ${premier.designation} et ${nbArticles - 1} autre${nbArticles > 2 ? "s" : ""} article${nbArticles > 2 ? "s" : ""}`;

  if (totalEstime !== null) {
    return `Votre devis pour ${resumeArticles} s'élève à environ ${totalEstime.toLocaleString("fr-FR")} francs CFA. Souhaitez-vous que je le transmette pour validation ?`;
  }

  return `J'ai bien noté votre demande de cotation pour ${resumeArticles}. Un chiffrage précis va être calculé. Souhaitez-vous valider ?`;
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

  const parseResult = PreparerDevisSchema.safeParse(bodyJson);
  if (!parseResult.success) {
    const errorDetails = parseResult.error.issues.map((i) => i.message).join(" ");
    return NextResponse.json(
      { error: "Validation échouée", details: errorDetails },
      { status: 400 }
    );
  }

  const { client_id, organization_id, articles } = parseResult.data;

  // Calcul des sous-totaux et total estimé
  let totalEstime: number | null = 0;
  let aUnPrixInconnu = false;

  const lignesCalculees = articles.map((art) => {
    const prix = art.prix_unitaire ?? null;
    let sousTotal: number | null = null;
    if (prix !== null) {
      sousTotal = prix * art.quantite;
      if (totalEstime !== null) totalEstime += sousTotal;
    } else {
      aUnPrixInconnu = true;
    }

    return {
      produit_id: art.produit_id,
      designation: art.designation,
      quantite: art.quantite,
      prix_unitaire: prix,
      sous_total: sousTotal,
    };
  });

  if (aUnPrixInconnu && totalEstime === 0) {
    totalEstime = null;
  }

  const reference = `DEV-${Date.now().toString().slice(-6)}`;
  const message = genererMessageVocalDevis(articles, totalEstime);

  try {
    // Si l'écriture est activée et qu'on n'est pas en mock, on prépare l'appel RFQ Blok
    const writeResult = await createBlokRfq({
      organizationId: organization_id,
      fileName: `${reference}.pdf`,
      lineItems: articles.map((a) => ({
        extractedText: `${a.quantite}x ${a.designation}`,
        matchedProduct: a.produit_id ? { id: a.produit_id } : null,
      })),
    });

    const isSimulation = isMockMode() || writeResult.writesDisabled;

    return NextResponse.json({
      devis: {
        reference,
        client_id,
        lignes: lignesCalculees,
        total_estime: totalEstime,
        statut: writeResult.writesDisabled ? "pret_en_attente_confirmation" : "rfq_transmise_a_blok",
        pdf_url: `https://blok.africa/quotes/${reference}/download.pdf`,
      },
      ecriture_activee: isWritesEnabled(),
      message,
      ...(isSimulation ? { simulation: true } : {}),
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
      { error: "Une erreur inattendue est survenue lors de la préparation du devis.", details: genericMsg },
      { status: 500 }
    );
  }
}
