/**
 * Client pour l'API Externe Blok (https://core-api-dev.blok.africa/api/external)
 * 
 * Règles de sécurité et architecture :
 * - Clé d'API strictement confinée dans BLOK_API_KEY (jamais exposée ni loguée).
 * - Timeout strict de 8 secondes avec contrôleur d'abandon (AbortController).
 * - Les écritures chez Blok sont désactivées par défaut (drapeau ENABLE_WRITES=false).
 * - Support du mode secours transparent (MOCK=true) pour la démo hackathon.
 */

import { MOCK_CATALOG, MOCK_CLIENTS, MockProduct, MockClient } from "./mock-data";

export class BlokApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code?: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "BlokApiError";
  }
}

interface BlokRequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 8000;

export function isMockMode(): boolean {
  if (process.env.MOCK === "true") return true;
  // Si aucune clé n'est configurée, fallback automatique sur le mode simulation pour éviter le blocage
  if (!process.env.BLOK_API_KEY || process.env.BLOK_API_KEY.trim() === "") return true;
  return false;
}

export function isWritesEnabled(): boolean {
  return process.env.ENABLE_WRITES === "true";
}

function getBlokConfig() {
  const apiKey = process.env.BLOK_API_KEY?.trim();
  const baseUrl = (process.env.BLOK_BASE_URL || "https://core-api-dev.blok.africa/api/external").replace(/\/+$/, "");

  if (!apiKey && !isMockMode()) {
    throw new BlokApiError(
      "Configuration serveur manquante : BLOK_API_KEY n'est pas définie dans l'environnement serveur.",
      500,
      "CONFIG_MISSING_API_KEY"
    );
  }

  return { apiKey: apiKey || "", baseUrl };
}

/**
 * Exécute un appel HTTP sécurisé vers l'API Blok avec timeout de 8 secondes
 */
export async function callBlokApi<T>(endpoint: string, options: BlokRequestOptions = {}): Promise<T> {
  const { apiKey, baseUrl } = getBlokConfig();
  const { method = "GET", body, timeoutMs = DEFAULT_TIMEOUT_MS } = options;

  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const fullUrl = `${baseUrl}${cleanEndpoint}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const headers: Record<string, string> = {
    "X-API-Key": apiKey,
    "Accept": "application/json",
  };

  let serializedBody: string | undefined;
  if (body !== undefined && method !== "GET") {
    headers["Content-Type"] = "application/json";
    serializedBody = JSON.stringify(body);
  }

  try {
    const response = await fetch(fullUrl, {
      method,
      headers,
      body: serializedBody,
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!response.ok) {
      let errorBody: unknown = null;
      try {
        errorBody = await response.json();
      } catch {
        // Corps non-JSON
      }

      switch (response.status) {
        case 401:
          throw new BlokApiError(
            "Authentification échouée auprès de Blok : clé API manquante ou invalide.",
            401,
            "UNAUTHORIZED",
            errorBody
          );
        case 403:
          throw new BlokApiError(
            "Accès refusé par Blok : permissions insuffisantes (ex: access_external_* requise).",
            403,
            "FORBIDDEN",
            errorBody
          );
        case 404:
          throw new BlokApiError(
            `Ressource introuvable sur Blok pour la route ${cleanEndpoint}.`,
            404,
            "NOT_FOUND",
            errorBody
          );
        case 429:
          throw new BlokApiError(
            "Trop de requêtes envoyées à l'API Blok (Rate Limit dépassé).",
            429,
            "RATE_LIMITED",
            errorBody
          );
        default:
          if (response.status >= 500 && response.status < 600) {
            throw new BlokApiError(
              `Erreur interne du serveur Blok (HTTP ${response.status}).`,
              response.status,
              "BLOK_SERVER_ERROR",
              errorBody
            );
          }
          throw new BlokApiError(
            `Réponse inattendue de Blok (HTTP ${response.status}).`,
            response.status,
            "UNEXPECTED_STATUS",
            errorBody
          );
      }
    }

    try {
      return (await response.json()) as T;
    } catch {
      throw new BlokApiError(
        "Réponse inattendue de Blok : le corps de la réponse n'est pas un JSON valide.",
        502,
        "INVALID_JSON_RESPONSE"
      );
    }
  } catch (err: unknown) {
    clearTimeout(timer);

    if (err instanceof BlokApiError) {
      throw err;
    }

    if (err instanceof Error && err.name === "AbortError") {
      throw new BlokApiError(
        `Délai d'attente dépassé (${timeoutMs / 1000}s) lors de la communication avec Blok.`,
        504,
        "GATEWAY_TIMEOUT"
      );
    }

    const message = err instanceof Error ? err.message : "Erreur réseau";
    throw new BlokApiError(
      `Impossible de joindre le serveur Blok : ${message}`,
      502,
      "NETWORK_ERROR"
    );
  }
}

// ==========================================
// ROUTES DE LECTURE (OFFICIELLES BLOK)
// ==========================================

/**
 * 1. Recherche de produits (POST /products selon la spec Blok)
 */
export async function searchBlokProducts(search: string, limit: number = 5): Promise<{ data: unknown[]; isMock: boolean }> {
  if (isMockMode()) {
    const q = search.toLowerCase().trim();
    const results = MOCK_CATALOG.filter(
      (p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)
    ).slice(0, limit);
    return { data: results, isMock: true };
  }

  const raw = await callBlokApi<unknown>("/products", {
    method: "POST",
    body: {
      search: search.trim(),
      limit: Math.min(Math.max(limit, 1), 100),
      offset: 0,
    },
  });

  return { data: extractItemsFromBlokResponse(raw), isMock: false };
}

/**
 * 2. Liste des clients (GET /customers)
 */
export async function getBlokCustomers(): Promise<{ data: unknown[]; isMock: boolean }> {
  if (isMockMode()) {
    return { data: MOCK_CLIENTS, isMock: true };
  }

  const raw = await callBlokApi<unknown>("/customers", { method: "GET" });
  return { data: extractItemsFromBlokResponse(raw), isMock: false };
}

/**
 * 3. Détail d'un client (GET /customers/{id})
 */
export async function getBlokCustomerDetail(id: string | number): Promise<{ data: unknown; isMock: boolean }> {
  if (isMockMode()) {
    const client = MOCK_CLIENTS.find((c) => c.id.toString() === id.toString()) || null;
    return { data: client, isMock: true };
  }

  const raw = await callBlokApi<unknown>(`/customers/${id}`, { method: "GET" });
  return { data: raw, isMock: false };
}

/**
 * 4. Liste des produits unmatched (GET /unmatched-products/unmatched)
 */
export async function getBlokUnmatchedProducts(): Promise<{ data: unknown[]; isMock: boolean }> {
  if (isMockMode()) {
    return {
      data: [
        { id: 901, term: "ciment blanc 25kg", created_at: "2026-10-27T10:00:00Z", status: "pending" },
        { id: 902, term: "brique réfractaire 22x11x6", created_at: "2026-10-27T14:30:00Z", status: "pending" }
      ],
      isMock: true
    };
  }

  const raw = await callBlokApi<unknown>("/unmatched-products/unmatched", { method: "GET" });
  return { data: extractItemsFromBlokResponse(raw), isMock: false };
}

/**
 * 5. Téléchargement du devis PDF généré (GET /quotes/{id}/pdf)
 */
export async function getBlokQuotePdf(quoteId: string | number): Promise<{ pdfUrl?: string; isMock: boolean }> {
  if (isMockMode()) {
    return {
      pdfUrl: `https://mock.blok.africa/quotes/${quoteId}/devis.pdf`,
      isMock: true,
    };
  }

  const raw = await callBlokApi<{ url?: string; file_url?: string }>(`/quotes/${quoteId}/pdf`, { method: "GET" });
  return {
    pdfUrl: raw.url || raw.file_url,
    isMock: false,
  };
}

// ==========================================
// ROUTES D'ÉCRITURE (SOUS DRAPEAU ENABLE_WRITES)
// ==========================================

export interface CreateRfqInput {
  organizationId: number;
  fileName?: string;
  lineItems: Array<{
    extractedText?: string;
    matchedProduct?: Record<string, unknown> | null;
  }>;
}

/**
 * Créer une RFQ chez Blok (POST /rfqs)
 * Désactivé tant que ENABLE_WRITES n'est pas "true"
 */
export async function createBlokRfq(input: CreateRfqInput): Promise<{ success: boolean; data?: unknown; writesDisabled?: boolean }> {
  if (!isWritesEnabled()) {
    return {
      success: true,
      writesDisabled: true,
      data: {
        simulated: true,
        message: "Écriture externe chez Blok ignorée (ENABLE_WRITES=false). Devis préparé en interne.",
        rfq_preview: input
      }
    };
  }

  const res = await callBlokApi<unknown>("/rfqs", {
    method: "POST",
    body: {
      organization_id: input.organizationId,
      file_name: input.fileName || "devis-vocal-aethex.pdf",
      line_items: input.lineItems.map((item) => ({
        extracted_text: item.extractedText,
        matched_product: item.matchedProduct ?? null,
      })),
    },
  });

  return { success: true, data: res, writesDisabled: false };
}

/**
 * Extraire une liste d'éléments d'une réponse Blok (formats variés : array direct, .data, .products, etc.)
 */
function extractItemsFromBlokResponse(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data;
    if (Array.isArray(obj.products)) return obj.products;
    if (Array.isArray(obj.items)) return obj.items;
    if (Array.isArray(obj.results)) return obj.results;
  }
  return [];
}
