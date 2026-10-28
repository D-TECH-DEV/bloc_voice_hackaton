import { HttpStatus } from '@nestjs/common';
import { ApiError, type ApiErrorCode } from '../common/errors/api-error';

/**
 * Erreurs du connecteur Core : validation et réseau sont DEUX familles distinctes.
 * Aucun contournement de 401/403 : ces erreurs remontent et bloquent la décision.
 */
export class CoreHttpError extends ApiError {
  constructor(status: number, message: string, code: ApiErrorCode, endpoint: string) {
    const mapped =
      status === HttpStatus.UNAUTHORIZED
        ? HttpStatus.BAD_GATEWAY
        : status === HttpStatus.FORBIDDEN
          ? HttpStatus.BAD_GATEWAY
          : HttpStatus.BAD_GATEWAY;
    super(code, `${message} (Core ${endpoint} -> HTTP ${status}).`, mapped);
  }
}

export function mapCoreStatus(status: number, endpoint: string): never {
  switch (status) {
    case 400:
    case 422:
      throw new CoreHttpError(status, 'Requête refusée par le Core (validation)', 'CORE_VALIDATION', endpoint);
    case 401:
      throw new CoreHttpError(status, 'Authentification Core refusée : clé manquante ou invalide', 'CORE_ERROR', endpoint);
    case 403:
      throw new CoreHttpError(status, 'Permission Core insuffisante : contournement interdit', 'CORE_FORBIDDEN', endpoint);
    case 404:
      throw new CoreHttpError(status, 'Ressource introuvable côté Core', 'CORE_NOT_FOUND', endpoint);
    default:
      if (status >= 500) {
        throw new CoreHttpError(status, 'Erreur interne du Core', 'CORE_ERROR', endpoint);
      }
      throw new CoreHttpError(status, 'Réponse inattendue du Core', 'CORE_ERROR', endpoint);
  }
}

export function coreUnavailable(endpoint: string, cause: string): ApiError {
  return new ApiError(
    'CORE_UNAVAILABLE',
    `Core indisponible (${endpoint}) : ${cause}. Aucune donnée de remplacement n'a été fabriquée.`,
    HttpStatus.BAD_GATEWAY,
  );
}
