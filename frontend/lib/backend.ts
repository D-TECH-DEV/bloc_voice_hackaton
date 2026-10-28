const BACKEND = process.env.BACKEND_URL ?? "http://127.0.0.1:3001";

export interface BackendResult<T = unknown> {
  ok: boolean;
  status: number;
  data: T;
}

/**
 * Appel serveur -> backend NestJS. Le jeton opérateur reste côté serveur :
 * le navigateur ne voit que les routes same-origin /api/backend/*.
 */
export async function callBackend<T = unknown>(
  path: string,
  init: { method?: string; body?: unknown; admin?: boolean } = {},
): Promise<BackendResult<T>> {
  const token = init.admin
    ? process.env.OPERATOR_ADMIN_TOKEN
    : process.env.OPERATOR_TOKEN;
  if (!token) {
    return { ok: false, status: 503, data: { message: "Interface non configurée (jeton absent)." } as T };
  }
  let res: Response;
  try {
    res = await fetch(`${BACKEND}${path}`, {
      method: init.method ?? "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
    });
  } catch {
    return { ok: false, status: 502, data: { message: "Backend injoignable." } as T };
  }
  let data: T;
  try {
    data = (await res.json()) as T;
  } catch {
    data = { message: `Réponse inattendue (HTTP ${res.status}).` } as T;
  }
  return { ok: res.ok, status: res.status, data };
}
