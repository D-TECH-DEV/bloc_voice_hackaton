import { Module } from '@nestjs/common';
import { CallAttemptsModule } from '../call-attempts/call-attempts.module';
import { CoreIntegrationModule } from '../core-integration/core-integration.module';
import { HandoffsModule } from '../handoffs/handoffs.module';
import { MaterialListsModule } from '../material-lists/material-lists.module';
import { VoiceConsentsModule } from '../voice-consents/voice-consents.module';
import { VoiceToolsController } from './voice-tools.controller';

@Module({
  imports: [
    CoreIntegrationModule,
    MaterialListsModule,
    CallAttemptsModule,
    VoiceConsentsModule,
    HandoffsModule,
  ],
  controllers: [VoiceToolsController],
})
export class VoiceToolsModule {}
