import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { OperatorTokenGuard } from './operator-token.guard';
import { VoiceToolGuard } from './voice-tool.guard';

@Module({
  providers: [
    OperatorTokenGuard,
    VoiceToolGuard,
    // Note : la garde opérateur n'est PAS globale : /health et /api/docs
    // restent publics, chaque contrôleur métier l'applique explicitement.
  ],
  exports: [OperatorTokenGuard, VoiceToolGuard],
})
export class AuthModule {}
