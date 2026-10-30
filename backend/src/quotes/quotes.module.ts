import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CoreIntegrationModule } from '../core-integration/core-integration.module';
import { VoiceSession, VoiceSessionItem } from '../entities/voice-session.entity';
import { Quote } from './quote.entity';
import { QuotesController } from './quotes.controller';
import { QuotesService } from './quotes.service';

@Module({
  imports: [TypeOrmModule.forFeature([Quote, VoiceSession, VoiceSessionItem]), CoreIntegrationModule],
  controllers: [QuotesController],
  providers: [QuotesService],
  exports: [QuotesService],
})
export class QuotesModule {}
