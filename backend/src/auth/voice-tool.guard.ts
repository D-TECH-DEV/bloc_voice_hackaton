import { createHash, timingSafeEqual } from 'crypto';
import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiError } from '../common/errors/api-error';
import type { AppConfig } from '../config/configuration';

/**
 * Garde des outils vocaux (AethexAI -> backend).
 * Secret partagé via l'en-tête `x-voice-tool-secret`, déclaré dans la
 * configuration du tool AethexAI (`headers` de add_agent_tool).
 * Fermé par défaut : sans secret configuré, tous les outils sont désactivés.
 */
@Injectable()
export class VoiceToolGuard implements CanActivate {
  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get('VOICE_TOOL_SECRET', { infer: true });
    if (!expected || expected.length < 16) {
      throw new ApiError(
        'TOOLS_DISABLED',
        "Outils vocaux désactivés (secret non configuré).",
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    const request = context.switchToHttp().getRequest();
    const provided: string = request.headers?.['x-voice-tool-secret'] ?? '';
    if (!provided || !safeEqual(provided, expected)) {
      throw new ApiError('UNAUTHORIZED', 'Secret outil invalide.', HttpStatus.UNAUTHORIZED);
    }
    return true;
  }
}

function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a, 'utf8').digest();
  const hb = createHash('sha256').update(b, 'utf8').digest();
  return ha.length === hb.length && timingSafeEqual(ha, hb);
}
