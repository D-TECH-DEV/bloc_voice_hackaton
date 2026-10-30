import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CoreIntegrationModule } from '../core-integration/core-integration.module';
import {
  VoiceSession,
  VoiceSessionItem,
  VoiceSessionSearch,
} from '../entities/voice-session.entity';
import { VoiceSessionsController } from './voice-sessions.controller';
import { VoiceSessionsService } from './voice-sessions.service';

@Module({
  imports: [TypeOrmModule.forFeature([VoiceSession, VoiceSessionSearch, VoiceSessionItem]), CoreIntegrationModule],
  controllers: [VoiceSessionsController],
  providers: [VoiceSessionsService],
  exports: [VoiceSessionsService],
})
export class VoiceSessionsModule {}
