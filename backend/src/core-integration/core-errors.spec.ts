import { mapCoreStatus } from './core-errors';

describe('mapCoreStatus (erreurs Core typées)', () => {
  test.each([
    [400, 'CORE_VALIDATION'],
    [422, 'CORE_VALIDATION'],
    [401, 'CORE_ERROR'],
    [403, 'CORE_FORBIDDEN'],
    [404, 'CORE_NOT_FOUND'],
    [500, 'CORE_ERROR'],
    [502, 'CORE_ERROR'],
  ])('HTTP %i -> %s', (status, code) => {
    try {
      mapCoreStatus(status, '/products');
      throw new Error('aurait dû lever');
    } catch (error) {
      expect(error).toMatchObject({ response: expect.objectContaining({ code }) });
    }
  });
});
