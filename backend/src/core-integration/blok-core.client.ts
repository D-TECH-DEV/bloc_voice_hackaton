import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiError } from '../common/errors/api-error';
import { coreUnavailable, mapCoreStatus } from './core-errors';
import type { AppConfig } from '../config/configuration';

export interface CoreCallOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  timeoutMs?: number;
}

/**
 * Unique point de sortie vers le Core API externe.
 * - Clé X-API-Key confinée ici, jamais journalisée ni transmise.
 * - Timeout explicite (défaut 8 s, comme le prototype d'équipe).
 * - Pas de retry aveugle : les écritures ne sont jamais rejouées automatiquement.
 * - Mode secours (MOCK_CORE ou clé absente) : fixtures marquées `mock: true`.
 */
@Injectable()
export class BlokCoreClient {
  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  isMockMode(): boolean {
    if (this.config.get('MOCK_CORE', { infer: true })) return true;
    return this.config.get('CORE_API_KEY', { infer: true }).trim().length === 0;
  }

  writesEnabled(): boolean {
    return this.config.get('ENABLE_CORE_WRITES', { infer: true });
  }

  assertWritesEnabled(): void {
    if (!this.writesEnabled()) {
      throw new ApiError(
        'WRITES_DISABLED',
        'Écritures vers le Core désactivées (ENABLE_CORE_WRITES=false).',
        HttpStatus.CONFLICT,
      );
    }
  }

  async call<T>(endpoint: string, options: CoreCallOptions = { method: 'GET' }): Promise<T> {
    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const baseUrl = this.config.get('CORE_API_BASE_URL', { infer: true }).replace(/\/+$/, '');
    const timeoutMs =
      options.timeoutMs ?? this.config.get('CORE_API_TIMEOUT_MS', { infer: true });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${baseUrl}${path}`, {
        method: options.method,
        headers: {
          'X-API-Key': this.config.get('CORE_API_KEY', { infer: true }),
          Accept: 'application/json',
          ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });
      if (!response.ok) {
        let errorBody: unknown = null;
        try {
          errorBody = await response.json();
        } catch {
          errorBody = null;
        }
        void errorBody;
        mapCoreStatus(response.status, path);
        throw new Error('unreachable');
      }
      try {
        return (await response.json()) as T;
      } catch {
        throw coreUnavailable(path, 'réponse non-JSON du Core');
      }
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        throw coreUnavailable(path, `délai dépassé (${timeoutMs} ms)`);
      }
      throw coreUnavailable(path, 'erreur réseau');
    } finally {
      clearTimeout(timer);
    }
  }
}
