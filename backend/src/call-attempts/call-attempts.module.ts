import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CallAttempt } from '../entities/call-attempt.entity';
import { OutreachTasksModule } from '../outreach-tasks/outreach-tasks.module';
import { VoiceConsentsModule } from '../voice-consents/voice-consents.module';
import { CallAttemptsService } from './call-attempts.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CallAttempt]),
    OutreachTasksModule,
    VoiceConsentsModule,
  ],
  providers: [CallAttemptsService],
  exports: [CallAttemptsService],
})
export class CallAttemptsModule {}
