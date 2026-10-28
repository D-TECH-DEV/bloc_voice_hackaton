import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiError } from '../common/errors/api-error';
import type { AppConfig } from '../config/configuration';
import { SystemActivation } from '../entities/system-activation.entity';

/**
 * Sécurité téléphonie : AUCUN fournisseur réel n'est câblé.
 * Composer un appel exige le double verrou :
 *  1. `OUTBOUND_CALLS_ENABLED=true` dans l'environnement ;
 *  2. ligne `telephony_outbound` active en base (activation tracée).
 * Par défaut, les deux sont faux : le système est en `manual_only`.
 */
@Injectable()
export class TelephonySafetyService {
  constructor(
    private readonly config: ConfigService<AppConfig, true>,
    @InjectRepository(SystemActivation)
    private readonly activations: Repository<SystemActivation>,
  ) {}

  async isActivated(): Promise<boolean> {
    if (!this.config.get('OUTBOUND_CALLS_ENABLED', { infer: true })) return false;
    const row = await this.activations.findOne({ where: { key: 'telephony_outbound' } });
    return row?.active === true;
  }

  /** Seul point d'entrée d'un appel sortant : inerte tant que non activé. */
  async placeCall(_input: { to: string; taskId: string }): Promise<never> {
    if (!(await this.isActivated())) {
      throw new ApiError(
        'TELEPHONY_DISABLED',
        'Appels sortants désactivés (double verrou telephony_outbound non validé).',
        HttpStatus.FORBIDDEN,
      );
    }
    // Aucun fournisseur réel câblé : même activé, aucun appel ne peut partir
    // sans l'intégration d'un fournisseur validé (voir docs/runbook.md).
    throw new ApiError(
      'TELEPHONY_DISABLED',
      'Aucun fournisseur de téléphonie validé : appel non émis.',
      HttpStatus.NOT_IMPLEMENTED,
    );
  }
}
