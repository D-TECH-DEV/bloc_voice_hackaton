import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { CallAttemptsModule } from '../call-attempts/call-attempts.module';
import { CoreIntegrationModule } from '../core-integration/core-integration.module';
import { DecisionEngineModule } from '../decision-engine/decision-engine.module';
import { OutreachTasksModule } from '../outreach-tasks/outreach-tasks.module';
import { TelephonyModule } from '../telephony/telephony.module';
import { VoiceConsentsModule } from '../voice-consents/voice-consents.module';
import { DueTasksScheduler } from './due-tasks.scheduler';

@Module({
  imports: [
    OutreachTasksModule,
    VoiceConsentsModule,
    DecisionEngineModule,
    AuditModule,
    TelephonyModule,
    CoreIntegrationModule,
    CallAttemptsModule,
  ],
  providers: [DueTasksScheduler],
})
export class SchedulerModule {}
