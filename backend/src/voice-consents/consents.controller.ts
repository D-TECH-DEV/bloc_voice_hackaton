import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { AuditService } from '../audit/audit.service';
import { OperatorTokenGuard, Roles } from '../auth/operator-token.guard';
import { forbidden } from '../common/errors/api-error';
import type { ConsentStatus } from '../entities/voice-consent.entity';
import { VoiceConsentsService } from './voice-consents.service';

class RecordConsentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  customerRef!: string;

  @IsIn(['granted', 'refused', 'withdrawn'])
  status!: ConsentStatus;

  @IsString()
  @MinLength(1)
  @MaxLength(32)
  source!: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  proofRef?: string;
}

class OptOutDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  customerRef!: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  proofRef?: string;
}

@ApiTags('consents')
@ApiBearerAuth()
@UseGuards(OperatorTokenGuard)
@Controller('api/v1/relance/consents')
export class ConsentsController {
  constructor(
    private readonly consents: VoiceConsentsService,
    private readonly audit: AuditService,
  ) {}

  @Get(':customerRef')
  async get(@Param('customerRef') customerRef: string) {
    const status = await this.consents.getStatus(customerRef);
    return { customerRef, channel: 'voice', status };
  }

  @Get(':customerRef/history')
  history(@Param('customerRef') customerRef: string) {
    return this.consents.history(customerRef);
  }

  /** Enregistrement opérateur (accord ou opposition). La levée d'opposition exige le rôle admin. */
  @Roles('admin', 'sales')
  @Post()
  async record(@Body() dto: RecordConsentDto, @Req() req: { operator: { role: string } }) {
    if (dto.status === 'granted') {
      const current = await this.consents.getStatus(dto.customerRef);
      if ((current === 'refused' || current === 'withdrawn') && req.operator.role !== 'admin') {
        throw forbidden("Levée d'opposition réservée au rôle admin.");
      }
    }
    const saved = await this.consents.record({
      customerRef: dto.customerRef,
      status: dto.status,
      source: dto.source,
      proofRef: dto.proofRef,
      changedBy: `operator:${req.operator.role}`,
    });
    await this.audit.logOperatorAction(req.operator.role, 'consent.record', saved.customerRef, {
      status: saved.status,
    });
    return saved;
  }

  @Roles('admin', 'sales')
  @Post('opt-out')
  async optOut(@Body() dto: OptOutDto, @Req() req: { operator: { role: string } }) {
    const saved = await this.consents.recordOptOut(
      dto.customerRef,
      'operateur',
      `operator:${req.operator.role}`,
      dto.proofRef,
    );
    await this.audit.logOperatorAction(req.operator.role, 'consent.opt_out', saved.customerRef, undefined);
    return saved;
  }
}
