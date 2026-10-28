import { Injectable } from '@nestjs/common';
import { ApiError } from '../common/errors/api-error';
import { HttpStatus } from '@nestjs/common';

/**
 * `POST /api/external/notifications` : route existante mais contrat
 * (corps, destinataires) NON vérifié. Toute tentative d'envoi échoue
 * explicitement : les transferts vivent dans la file interne (handoffs)
 * jusqu'à validation du contrat. Aucune notification fantôme.
 */
@Injectable()
export class NotificationsAdapter {
  async send(): Promise<never> {
    throw new ApiError(
      'CORE_ERROR',
      'Contrat POST /notifications non vérifié : envoi désactivé. ' +
        'Le transfert est enregistré en interne (handoffs) sans notification externe.',
      HttpStatus.CONFLICT,
    );
  }
}
