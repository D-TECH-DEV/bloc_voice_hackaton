import { createHash, timingSafeEqual } from 'crypto';
import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ApiError } from '../common/errors/api-error';
import type { AppConfig } from '../config/configuration';

export type OperatorRole = 'admin' | 'sales' | 'supervisor';

export const ROLES_KEY = 'required_roles';
export const Roles = (...roles: OperatorRole[]) => SetMetadata(ROLES_KEY, roles);

function sha256(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}

/**
 * Authentification des opérateurs par jeton opaque (comparaison à temps constant).
 * Fermé par défaut : sans jeton configuré, tout accès protégé est refusé.
 * Dev-grade : à remplacer par un IdP avant production (voir docs/security.md).
 */
@Injectable()
export class OperatorTokenGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const header: string = request.headers?.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token) {
      throw new ApiError('UNAUTHORIZED', 'Jeton opérateur manquant.', HttpStatus.UNAUTHORIZED);
    }
    const adminToken = this.config.get('OPERATOR_ADMIN_TOKEN', { infer: true });
    const salesToken = this.config.get('OPERATOR_SALES_TOKEN', { infer: true });
    let role: OperatorRole | null = null;
    if (adminToken && safeEqual(token, adminToken)) role = 'admin';
    else if (salesToken && safeEqual(token, salesToken)) role = 'sales';
    if (!role) {
      throw new ApiError('UNAUTHORIZED', 'Jeton opérateur invalide.', HttpStatus.UNAUTHORIZED);
    }
    request.operator = { role };
    const required = this.reflector.getAllAndOverride<OperatorRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (required && !required.includes(role)) {
      // Les admins héritent des droits commerciaux et supervision.
      throw new ApiError('FORBIDDEN', 'Permission insuffisante.', HttpStatus.FORBIDDEN);
    }
    return true;
  }
}

function safeEqual(a: string, b: string): boolean {
  const ha = sha256(a);
  const hb = sha256(b);
  return ha.length === hb.length && timingSafeEqual(ha, hb);
}
