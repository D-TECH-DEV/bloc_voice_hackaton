import { NextResponse } from "next/server";

export async function GET() {
  const openApiSpec = {
    openapi: "3.0.0",
    info: {
      title: "Blok Africa × AethexAI Voice Backend",
      description:
        "Documentation interactive OpenAPI 3.0 / Swagger des 4 outils HTTPS exposés pour l'Agent Vocal AethexAI sur la marketplace Blok Africa.",
      version: "1.0.0",
      contact: {
        name: "Équipe Blok Voice Backend - Hackathon AethexAI x Mstudio",
      },
    },
    servers: [
      {
        url: "/",
        description: "Serveur courant (Local / Tunnel / Production)",
      },
    ],
    security: [
      {
        ApiKeyAuth: [],
      },
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: "apiKey",
          in: "header",
          name: "x-agent-secret",
          description: "Clé secrète partagée exigée par chaque outil",
        },
      },
      schemas: {
        ErrorResponse: {
          type: "object",
          properties: {
            error: { type: "string", example: "Accès refusé : en-tête x-agent-secret manquant ou invalide." },
            details: { type: "string", example: "Le champ 'terme' est obligatoire." },
          },
        },
        ProduitItem: {
          type: "object",
          properties: {
            id: { type: "string", example: "101" },
            nom: { type: "string", example: "Ciment Bélier Classic CPJ 32.5 (Sac 50kg)" },
            prix: { type: "number", nullable: true, example: 4800, description: "Prix unitaire en FCFA" },
            unite: { type: "string", example: "sac" },
            disponible: { type: "boolean", example: true },
          },
        },
        RechercheProduitRequest: {
          type: "object",
          required: ["terme"],
          properties: {
            terme: {
              type: "string",
              description: "Matériau recherché par l'artisan (ex: ciment, fer, sable, gravier)",
              example: "ciment",
            },
          },
        },
        RechercheProduitResponse: {
          type: "object",
          properties: {
            produits: {
              type: "array",
              items: { $ref: "#/components/schemas/ProduitItem" },
            },
            message: {
              type: "string",
              description: "Texte naturel directement exploitable pour la synthèse vocale (TTS)",
              example: "J'ai trouvé 2 options pour \"ciment\". Le premier résultat est Ciment Bélier Classic CPJ 32.5 à 4 800 francs CFA. Souhaitez-vous d'autres détails ?",
            },
            simulation: {
              type: "boolean",
              example: true,
              description: "Indique si la réponse provient du catalogue de secours (failover)",
            },
          },
        },
        VerifierClientRequest: {
          type: "object",
          description: "Au moins un des champs doit être renseigné",
          properties: {
            telephone: {
              type: "string",
              description: "Numéro de téléphone de l'artisan",
              example: "+2250707070102",
            },
            nom: {
              type: "string",
              description: "Nom ou entreprise du client",
              example: "Kouassi Koffi",
            },
            id: {
              type: "string",
              description: "Identifiant Blok si connu",
              example: "501",
            },
          },
        },
        VerifierClientResponse: {
          type: "object",
          properties: {
            client: {
              type: "object",
              nullable: true,
              properties: {
                id: { type: "string", example: "501" },
                nom: { type: "string", example: "Kouassi Koffi" },
                telephone: { type: "string", example: "+2250707070102" },
                entreprise: { type: "string", example: "BTP Ivoire Construction" },
                statut: { type: "string", example: "actif" },
                historique: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      devis_id: { type: "string", example: "DEV-2026-089" },
                      date: { type: "string", example: "2026-10-20" },
                      montant_total: { type: "number", example: 240000 },
                      statut: { type: "string", example: "Livre" },
                      articles: {
                        type: "array",
                        items: { type: "string" },
                        example: ["50 sacs Ciment Bélier", "10 barres Fer de 10"],
                      },
                    },
                  },
                },
              },
            },
            message: {
              type: "string",
              example: "Bonjour Kouassi Koffi. Votre compte Blok est bien identifié. Votre dernière commande concernait : 50 sacs Ciment Bélier, 10 barres Fer de 10. Que souhaitez-vous commander aujourd'hui ?",
            },
            simulation: { type: "boolean", example: true },
          },
        },
        LigneDevisInput: {
          type: "object",
          required: ["designation", "quantite"],
          properties: {
            produit_id: { type: "string", example: "101" },
            designation: { type: "string", example: "Ciment Bélier CPJ 32.5" },
            quantite: { type: "integer", minimum: 1, example: 50 },
            prix_unitaire: { type: "number", example: 4800, description: "Prix en FCFA" },
          },
        },
        PreparerDevisRequest: {
          type: "object",
          required: ["articles"],
          properties: {
            client_id: { type: "string", example: "501" },
            organization_id: { type: "integer", example: 42 },
            articles: {
              type: "array",
              items: { $ref: "#/components/schemas/LigneDevisInput" },
            },
          },
        },
        PreparerDevisResponse: {
          type: "object",
          properties: {
            devis: {
              type: "object",
              properties: {
                reference: { type: "string", example: "DEV-284910" },
                client_id: { type: "string", example: "501" },
                lignes: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      designation: { type: "string", example: "Ciment Bélier CPJ 32.5" },
                      quantite: { type: "number", example: 50 },
                      prix_unitaire: { type: "number", example: 4800 },
                      sous_total: { type: "number", example: 240000 },
                    },
                  },
                },
                total_estime: { type: "number", example: 294000, description: "Total calculé en FCFA" },
                statut: { type: "string", example: "pret_en_attente_confirmation" },
                pdf_url: { type: "string", example: "https://blok.africa/quotes/DEV-284910/download.pdf" },
              },
            },
            ecriture_activee: { type: "boolean", example: false },
            message: {
              type: "string",
              example: "Votre devis pour 50 Ciment Bélier CPJ 32.5 s'élève à environ 240 000 francs CFA. Souhaitez-vous que je le transmette pour validation ?",
            },
          },
        },
        ProposerProduitAbsentRequest: {
          type: "object",
          required: ["designation"],
          properties: {
            designation: { type: "string", example: "Brique réfractaire 22x11x6" },
            unite: { type: "string", example: "brique", default: "unité" },
            quantite_estimee: { type: "number", example: 200 },
            commentaire: { type: "string", example: "Chantier à Cocody" },
            client_id: { type: "string", example: "501" },
          },
        },
        ProposerProduitAbsentResponse: {
          type: "object",
          properties: {
            produit_propose: {
              type: "object",
              properties: {
                id: { type: "string", example: "PROP-482910" },
                designation: { type: "string", example: "Brique réfractaire 22x11x6" },
                unite: { type: "string", example: "brique" },
                quantite_estimee: { type: "number", example: 200 },
                statut: { type: "string", example: "a_valider" },
                date_creation: { type: "string", example: "2026-10-28T08:50:00.000Z" },
              },
            },
            ecriture_activee: { type: "boolean", example: false },
            message: {
              type: "string",
              example: "J'ai bien noté votre demande pour \"Brique réfractaire 22x11x6\". Ce produit n'est pas encore au catalogue, mais votre demande est enregistrée avec le statut \"à valider\".",
            },
          },
        },
      },
    },
    paths: {
      "/api/rechercher-produit": {
        post: {
          tags: ["Outils Agent Vocal AethexAI"],
          summary: "1. Rechercher un matériau dans le catalogue",
          description:
            "Trouve les matériaux de construction (prix FCFA, unités, disponibilités) dans le catalogue Blok à partir de mots-clés prononcés par le client.",
          operationId: "rechercher_produit",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/RechercheProduitRequest" },
              },
            },
          },
          responses: {
            200: {
              description: "Produits trouvés avec message vocal préformaté",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/RechercheProduitResponse" },
                },
              },
            },
            400: {
              description: "Terme de recherche manquant ou invalide",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } },
              },
            },
            401: {
              description: "En-tête x-agent-secret manquant ou invalide",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } },
              },
            },
            502: {
              description: "Erreur ou timeout auprès de l'API Blok",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } },
              },
            },
          },
        },
      },
      "/api/verifier-client": {
        post: {
          tags: ["Outils Agent Vocal AethexAI"],
          summary: "2. Vérifier et identifier un client par téléphone ou nom",
          description:
            "Identifie l'artisan sur le chantier pour retrouver son compte, son historique et personnaliser l'accueil vocal.",
          operationId: "verifier_client",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/VerifierClientRequest" },
              },
            },
          },
          responses: {
            200: {
              description: "Fiche client retrouvée ou notification de nouveau client",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/VerifierClientResponse" },
                },
              },
            },
            400: {
              description: "Aucun critère fourni",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } },
              },
            },
            401: {
              description: "En-tête x-agent-secret manquant ou invalide",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } },
              },
            },
          },
        },
      },
      "/api/preparer-devis": {
        post: {
          tags: ["Outils Agent Vocal AethexAI"],
          summary: "3. Préparer et chiffrer un devis de matériaux",
          description:
            "Calcule les sous-totaux et le total estimé en FCFA pour la liste des matériaux demandés sans écriture prématurée.",
          operationId: "preparer_devis",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PreparerDevisRequest" },
              },
            },
          },
          responses: {
            200: {
              description: "Devis chiffré prêt pour validation orale",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/PreparerDevisResponse" },
                },
              },
            },
            400: {
              description: "Liste d'articles vide ou format incorrect",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } },
              },
            },
            401: {
              description: "En-tête x-agent-secret manquant ou invalide",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } },
              },
            },
          },
        },
      },
      "/api/proposer-produit-absent": {
        post: {
          tags: ["Outils Agent Vocal AethexAI"],
          summary: "4. Enregistrer un matériau introuvable",
          description:
            "Enregistre la demande d'un matériau hors catalogue avec le statut 'à valider' pour transmission à l'équipe commerciale Blok.",
          operationId: "proposer_produit_absent",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ProposerProduitAbsentRequest" },
              },
            },
          },
          responses: {
            200: {
              description: "Demande enregistrée avec succès",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ProposerProduitAbsentResponse" },
                },
              },
            },
            400: {
              description: "Désignation manquante ou trop courte",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } },
              },
            },
            401: {
              description: "En-tête x-agent-secret manquant ou invalide",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } },
              },
            },
          },
        },
      },
    },
  };

  return NextResponse.json(openApiSpec, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, x-agent-secret",
    },
  });
}
