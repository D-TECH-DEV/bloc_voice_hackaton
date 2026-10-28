import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConsentEvent } from '../entities/consent-event.entity';
import { VoiceConsent } from '../entities/voice-consent.entity';
import { VoiceConsentsService } from './voice-consents.service';

@Module({
  imports: [TypeOrmModule.forFeature([VoiceConsent, ConsentEvent])],
  providers: [VoiceConsentsService],
  exports: [VoiceConsentsService],
})
export class VoiceConsentsModule {}
