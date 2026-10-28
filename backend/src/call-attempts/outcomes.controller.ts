import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { OperatorTokenGuard } from '../auth/operator-token.guard';
import { CallAttemptsService } from './call-attempts.service';
import type { AttemptOutcome } from '../entities/call-attempt.entity';

class OutcomeDto {
  @IsUUID()
  attemptId!: string;

  @IsIn(['completed', 'no_answer', 'failed', 'refused'])
  outcome!: AttemptOutcome;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  summary!: string;

  @IsOptional()
  @IsString()
  nextAction?: string;
}

@ApiTags('attempts')
@ApiBearerAuth()
@UseGuards(OperatorTokenGuard)
@Controller('api/v1/relance')
export class OutcomesController {
  constructor(private readonly attempts: CallAttemptsService) {}

  /** Réception authentifiée et idempotente d'un résultat de tentative. */
  @Post('call-outcomes')
  record(@Body() dto: OutcomeDto, @Req() req: { operator: { role: string } }) {
    return this.attempts.recordOutcome({
      attemptId: dto.attemptId,
      outcome: dto.outcome,
      summary: dto.summary,
      nextAction: dto.nextAction,
      reportedBy: `operator:${req.operator.role}`,
    });
  }
}
