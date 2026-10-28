import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getBlokCustomers, getBlokCustomerDetail, BlokApiError } from "@/lib/blok";

// Schéma de validation Zod : au moins un critère d'identification doit être fourni
const VerifierClientSchema = z
  .object({
    telephone: z.string().trim().optional(),
    nom: z.string().trim().optional(),
    id: z.union([z.string(), z.number()]).optional(),
  })
  .refine((data) => data.telephone || data.nom || data.id !== undefined, {
    message: "Veuillez fournir au moins un critère de recherche (telephone, nom ou id).",
  });

interface RawCustomer {
  id?: string | number;
  name?: string;
  nom?: string;
  full_name?: string;
  phone?: string;
  telephone?: string;
  mobile?: string;
  company?: string;
  entreprise?: string;
  is_active?: boolean;
  status?: string;
  actif?: boolean;
  commandes_recentes?: Array<{
    devis_id: string;
    date: string;
    montant_total: number;
    statut: string;
    articles: string[];
  }>;
  [key: string]: unknown;
}

function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-\(\)\.]/g, "");
}

function genererMessageVocalClient(client: {
  nom: string;
  statut: string;
  commandes_recentes?: unknown[];
} | null, critere: string): string {
  if (!client) {
    return `Je n'ai trouvé aucun compte client correspondant à ${critere}. Souhaitez-vous que je crée une nouvelle fiche pour votre chantier ?`;
  }

  const derniereCmd = client.commandes_recentes && client.commandes_recentes.length > 0
    ? (client.commandes_recentes[0] as { articles?: string[] })
    : null;

  if (derniereCmd?.articles && derniereCmd.articles.length > 0) {
    return `Bonjour ${client.nom}. Votre compte Blok est bien identifié. Votre dernière commande concernait : ${derniereCmd.articles.join(", ")}. Que souhaitez-vous commander aujourd'hui ?`;
  }

  return `Bonjour ${client.nom}. Votre compte Blok est actif. Que souhaitez-vous commander pour votre chantier aujourd'hui ?`;
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

  const parseResult = VerifierClientSchema.safeParse(bodyJson);
  if (!parseResult.success) {
    const errorDetails = parseResult.error.issues.map((i) => i.message).join(" ");
    return NextResponse.json(
      { error: "Validation échouée", details: errorDetails },
      { status: 400 }
    );
  }

  const { telephone, nom, id } = parseResult.data;

  try {
    let matchedCustomer: RawCustomer | null = null;
    let isSimulation = false;

    // Si un ID direct est fourni, on interroge GET /customers/{id}
    if (id !== undefined) {
      const res = await getBlokCustomerDetail(id);
      isSimulation = res.isMock;
      matchedCustomer = res.data as RawCustomer | null;
    } else {
      // Sinon on recherche dans la liste GET /customers
      const res = await getBlokCustomers();
      isSimulation = res.isMock;
      const customersList = res.data as RawCustomer[];

      const cleanTel = telephone ? normalizePhone(telephone) : null;
      const cleanNom = nom ? nom.toLowerCase() : null;

      matchedCustomer = customersList.find((c) => {
        const cPhone = c.phone || c.telephone || c.mobile || "";
        const cName = (c.name || c.nom || c.full_name || "").toLowerCase();

        if (cleanTel && normalizePhone(cPhone).includes(cleanTel)) return true;
        if (cleanNom && cName.includes(cleanNom)) return true;
        return false;
      }) || null;
    }

    const critereRecherche = telephone || nom || `l'identifiant ${id}`;

    if (!matchedCustomer) {
      return NextResponse.json({
        client: null,
        message: genererMessageVocalClient(null, critereRecherche),
        ...(isSimulation ? { simulation: true } : {}),
      });
    }

    const clientNormalise = {
      id: matchedCustomer.id ?? "inconnu",
      nom: (matchedCustomer.name || matchedCustomer.nom || matchedCustomer.full_name || "Client Blok").toString(),
      telephone: (matchedCustomer.phone || matchedCustomer.telephone || matchedCustomer.mobile || telephone || "").toString(),
      entreprise: matchedCustomer.company || matchedCustomer.entreprise || undefined,
      statut: matchedCustomer.is_active !== false && matchedCustomer.actif !== false ? "actif" : "inactif",
      historique: matchedCustomer.commandes_recentes || [],
    };

    const message = genererMessageVocalClient(clientNormalise, critereRecherche);

    return NextResponse.json({
      client: clientNormalise,
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
      { error: "Une erreur inattendue est survenue lors de la vérification du client.", details: genericMsg },
      { status: 500 }
    );
  }
}
