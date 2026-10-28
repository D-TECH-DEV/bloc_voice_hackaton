import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createBlokRfq, isWritesEnabled, isMockMode, BlokApiError } from "@/lib/blok";

const ProposerProduitAbsentSchema = z.object({
  designation: z
    .string({
      required_error: "La désignation du produit est obligatoire.",
    })
    .trim()
    .min(2, "La désignation du produit doit comporter au moins 2 caractères."),
  unite: z.string().trim().optional().default("unité"),
  quantite_estimee: z.number().positive("La quantité estimée doit être positive.").optional(),
  commentaire: z.string().trim().optional(),
  client_id: z.union([z.string(), z.number()]).optional(),
});

function genererMessageVocalProduitAbsent(designation: string): string {
  return `J'ai bien noté votre demande pour "${designation}". Ce produit n'est pas encore au catalogue, mais votre demande est enregistrée avec le statut "à valider". Notre équipe commerciale Blok va vérifier la disponibilité auprès des fournisseurs.`;
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

  const parseResult = ProposerProduitAbsentSchema.safeParse(bodyJson);
  if (!parseResult.success) {
    const errorDetails = parseResult.error.issues.map((i) => i.message).join(" ");
    return NextResponse.json(
      { error: "Validation échouée", details: errorDetails },
      { status: 400 }
    );
  }

  const { designation, unite, quantite_estimee, commentaire, client_id } = parseResult.data;

  const idProposition = `PROP-${Date.now().toString().slice(-6)}`;
  const dateCreation = new Date().toISOString();

  try {
    // Si l'écriture chez Blok est activée, on transmet la ligne non matchée via l'endpoint RFQ
    const writeResult = await createBlokRfq({
      organizationId: 42,
      fileName: `demande-produit-absent-${idProposition}.pdf`,
      lineItems: [
        {
          extractedText: `${quantite_estimee ? quantite_estimee + " " : ""}${designation} (${unite}) - ${commentaire || "Demande vocale chantier"}`,
          matchedProduct: null, // Indique à Blok qu'il s'agit d'un produit absent / unmatched
        },
      ],
    });

    const isSimulation = isMockMode() || writeResult.writesDisabled;
    const message = genererMessageVocalProduitAbsent(designation);

    return NextResponse.json({
      produit_propose: {
        id: idProposition,
        designation,
        unite,
        quantite_estimee: quantite_estimee || null,
        commentaire: commentaire || null,
        client_id: client_id || null,
        statut: "a_valider",
        date_creation: dateCreation,
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
      { error: "Une erreur inattendue est survenue lors de l'enregistrement du produit absent.", details: genericMsg },
      { status: 500 }
    );
  }
}
