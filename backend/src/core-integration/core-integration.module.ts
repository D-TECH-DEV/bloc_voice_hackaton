import { Module } from '@nestjs/common';
import { BlokCoreClient } from './blok-core.client';
import { CatalogAdapter } from './catalog.adapter';
import { CustomersAdapter } from './customers.adapter';
import { RfqAdapter } from './rfq.adapter';
import { NotificationsAdapter } from './notifications.adapter';

/** Frontière anti-corruption : tout accès au Core passe par ce module. */
@Module({
  providers: [
    BlokCoreClient,
    CatalogAdapter,
    CustomersAdapter,
    RfqAdapter,
    NotificationsAdapter,
  ],
  exports: [BlokCoreClient, CatalogAdapter, CustomersAdapter, RfqAdapter, NotificationsAdapter],
})
export class CoreIntegrationModule {}
