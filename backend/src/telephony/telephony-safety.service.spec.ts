import type { ConfigService } from '@nestjs/config';
import type { Repository } from 'typeorm';
import { TelephonySafetyService } from './telephony-safety.service';
import type { AppConfig } from '../config/configuration';
import type { SystemActivation } from '../entities/system-activation.entity';

function safety(outbound: boolean, activationActive: boolean): TelephonySafetyService {
  const config = {
    get: (key: string) => (key === 'OUTBOUND_CALLS_ENABLED' ? outbound : undefined),
  } as unknown as ConfigService<AppConfig, true>;
  const repo = {
    findOne: async () => (activationActive ? { active: true } : null),
  } as unknown as Repository<SystemActivation>;
  return new TelephonySafetyService(config, repo);
}

describe('TelephonySafetyService (double verrou)', () => {
  test('configuration par défaut : désactivé', async () => {
    const service = safety(false, false);
    await expect(service.isActivated()).resolves.toBe(false);
    await expect(service.placeCall({ to: '+2250000000000', taskId: 't' })).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'TELEPHONY_DISABLED' }),
    });
  });

  test('env seul sans activation en base : désactivé', async () => {
    const service = safety(true, false);
    await expect(service.isActivated()).resolves.toBe(false);
    await expect(service.placeCall({ to: '+2250000000000', taskId: 't' })).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'TELEPHONY_DISABLED' }),
    });
  });

  test('double verrou validé mais aucun fournisseur câblé : aucun appel émis', async () => {
    const service = safety(true, true);
    await expect(service.isActivated()).resolves.toBe(true);
    // Même « activé », placeCall refuse : preuve d'architecture qu'aucun
    // appel commercial ne peut partir dans cette phase.
    await expect(service.placeCall({ to: '+2250000000000', taskId: 't' })).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'TELEPHONY_DISABLED' }),
    });
  });
});
