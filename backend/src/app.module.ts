import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminModule } from './admin/admin.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { CallAttemptsModule } from './call-attempts/call-attempts.module';
import { CoreIntegrationModule } from './core-integration/core-integration.module';
import { DecisionEngineModule } from './decision-engine/decision-engine.module';
import { HandoffsModule } from './handoffs/handoffs.module';
import { HealthController } from './health/health.controller';
import { MaterialListsModule } from './material-lists/material-lists.module';
import { OutreachTasksModule } from './outreach-tasks/outreach-tasks.module';
import { QuotesModule } from './quotes/quotes.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { TelephonyModule } from './telephony/telephony.module';
import { VoiceConsentsModule } from './voice-consents/voice-consents.module';
import { VoiceSessionsModule } from './voice-sessions/voice-sessions.module';
import { VoiceToolsModule } from './voice-tools/voice-tools.module';
import { loadConfiguration, type AppConfig } from './config/configuration';
import * as entities from './entities';
import { CallAttemptsService } from './call-attempts/call-attempts.service';
import { OutcomesController } from './call-attempts/outcomes.controller';
import { ConsentsController } from './voice-consents/consents.controller';
import { HandoffsController } from './handoffs/handoffs.controller';
import { MaterialListsController } from './material-lists/material-lists.controller';
import { TasksController } from './outreach-tasks/tasks.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [loadConfiguration] }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => ({
        type: 'postgres',
        host: config.get('DB_HOST', { infer: true }),
        port: config.get('DB_PORT', { infer: true }),
        username: config.get('DB_USER', { infer: true }),
        password: config.get('DB_PASSWORD', { infer: true }),
        database:
          process.env.NODE_ENV === 'test'
            ? config.get('DB_NAME_TEST', { infer: true })
            : config.get('DB_NAME', { infer: true }),
        entities: Object.values(entities),
        synchronize: false,
      }),
    }),
    AuthModule,
    AuditModule,
    CoreIntegrationModule,
    DecisionEngineModule,
    TelephonyModule,
    VoiceConsentsModule,
    VoiceSessionsModule,
    OutreachTasksModule,
    CallAttemptsModule,
    MaterialListsModule,
    QuotesModule,
    HandoffsModule,
    VoiceToolsModule,
    SchedulerModule,
    AdminModule,
  ],
  controllers: [
    HealthController,
    TasksController,
    ConsentsController,
    OutcomesController,
    MaterialListsController,
    HandoffsController,
  ],
})
export class AppModule {}
