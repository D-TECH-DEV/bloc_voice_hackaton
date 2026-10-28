import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { OperatorTokenGuard, Roles } from '../auth/operator-token.guard';
import { AuditService } from '../audit/audit.service';
import { HandoffsService } from './handoffs.service';

class CreateHandoffDto {
  @IsOptional()
  @IsString()
  taskId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  customerRef!: string;

  @IsString()
  @MinLength(10)
  motive!: string;

  @IsString()
  @MinLength(1)
  summary!: string;

  @IsOptional()
  @IsIn(['normal', 'high'])
  priority?: 'normal' | 'high';
}

class ResolveHandoffDto {
  @IsString()
  @MinLength(1)
  report!: string;

  @IsOptional()
  requalify?: boolean;
}

@ApiTags('handoffs')
@ApiBearerAuth()
@UseGuards(OperatorTokenGuard)
@Controller('api/v1/relance/handoffs')
export class HandoffsController {
  constructor(
    private readonly handoffs: HandoffsService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  list(@Query('status') status?: string) {
    return this.handoffs.list(status);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.handoffs.getById(id);
  }

  @Roles('admin', 'sales')
  @Post()
  async create(@Body() dto: CreateHandoffDto, @Req() req: { operator: { role: string } }) {
    const handoff = await this.handoffs.create(dto);
    await this.audit.logOperatorAction(req.operator.role, 'handoff.create', handoff.id, {
      customerRef: handoff.customerRef,
    });
    return handoff;
  }

  /** Prise en charge persistée (accusé de reprise). */
  @Roles('admin', 'sales')
  @Post(':id/claim')
  async claim(@Param('id') id: string, @Req() req: { operator: { role: string } }) {
    const handoff = await this.handoffs.claim(id, `operator:${req.operator.role}`);
    await this.audit.logOperatorAction(req.operator.role, 'handoff.claim', id, undefined);
    return handoff;
  }

  @Roles('admin', 'sales')
  @Post(':id/resolve')
  resolve(@Param('id') id: string, @Body() dto: ResolveHandoffDto, @Req() req: { operator: { role: string } }) {
    return this.handoffs.resolve(id, `operator:${req.operator.role}`, dto.report, dto.requalify === true);
  }
}
