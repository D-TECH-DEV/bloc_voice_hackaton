import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { OperatorTokenGuard, Roles } from '../auth/operator-token.guard';
import { VoiceSessionsService } from './voice-sessions.service';

export class CreateVoiceSessionDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  customerRef?: string;
}

@ApiTags('voice-sessions')
@ApiBearerAuth()
@UseGuards(OperatorTokenGuard)
@Controller('api/v1/relance/voice-sessions')
export class VoiceSessionsController {
  constructor(private readonly sessions: VoiceSessionsService) {}

  /** Crée le contexte d'une conversation vocale (opérateur ou page conversation). */
  @Roles('admin', 'sales')
  @Post()
  create(@Body() dto: CreateVoiceSessionDto) {
    return this.sessions.createSession({ customerRef: dto.customerRef, createdBy: 'operator:ui' });
  }

  /** Récapitulatif fidèle : rejouable à tout moment (fin d'appel, reconnexion). */
  @Roles('admin', 'sales')
  @Get(':id/recap')
  recap(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.sessions.getRecap(id);
  }

  /** Termine la conversation (idempotent). */
  @Roles('admin', 'sales')
  @Post(':id/end')
  end(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.sessions.endSession(id);
  }
}
