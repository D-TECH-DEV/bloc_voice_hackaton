import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';
import type { AppConfig } from '../config/configuration';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  @Get()
  check() {
    const coreKey = this.config.get('CORE_API_KEY', { infer: true });
    const outbound = this.config.get('OUTBOUND_CALLS_ENABLED', { infer: true });
    return {
      status: 'ok',
      // manual_only tant que la téléphonie n'est pas doublement activée (voir TelephonyModule).
      mode: outbound ? 'assisted' : 'manual_only',
      core_configured: coreKey.trim().length > 0,
      mock_core: this.config.get('MOCK_CORE', { infer: true }),
      core_writes_enabled: this.config.get('ENABLE_CORE_WRITES', { infer: true }),
      telephony_activated: false, // Vrai uniquement après la procédure explicite (jamais par défaut).
      now: new Date().toISOString(),
    };
  }
}
