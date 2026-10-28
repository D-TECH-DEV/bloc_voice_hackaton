import { HttpException, HttpStatus } from '@nestjs/common';

/** Codes d'erreur stables exposés par l'API interne (jamais de secret ni de trace brute). */
export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'CORE_UNAVAILABLE'
  | 'CORE_FORBIDDEN'
  | 'CORE_VALIDATION'
  | 'CORE_NOT_FOUND'
  | 'CORE_ERROR'
  | 'WRITES_DISABLED'
  | 'TOOLS_DISABLED'
  | 'TELEPHONY_DISABLED'
  | 'CALL_BLOCKED'
  | 'CONSENT_REQUIRED'
  | 'INTERNAL_ERROR';

export class ApiError extends HttpException {
  constructor(
    code: ApiErrorCode,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    details?: Record<string, unknown>,
  ) {
    super({ error: true, code, message, ...(details ? { details } : {}) }, status);
  }
}

export const notFound = (message: string) =>
  new ApiError('NOT_FOUND', message, HttpStatus.NOT_FOUND);
export const conflict = (message: string, details?: Record<string, unknown>) =>
  new ApiError('CONFLICT', message, HttpStatus.CONFLICT, details);
export const forbidden = (message: string) =>
  new ApiError('FORBIDDEN', message, HttpStatus.FORBIDDEN);
