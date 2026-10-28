import { Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { OperatorTokenGuard, Roles } from '../auth/operator-token.guard';
import { SystemActivation } from '../entities/system-activation.entity';

/**
 * Administration : journaux, supervision, activations.
 * Aucune route ne permet de contourner le moteur ou de composer un appel.
 */
@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(OperatorTokenGuard)
@Controller('api/v1/admin')
export class AdminController {
  constructor(
    private readonly audit: AuditService,
    @InjectRepository(SystemActivation)
    private readonly activations: Repository<SystemActivation>,
  ) {}

  @Roles('admin')
  @Get('decisions')
  decisions(@Query('limit') limit?: string) {
    return this.audit.recentDecisions(limit ? Number(limit) : 100);
  }

  @Roles('admin')
  @Get('activations')
  activationsState() {
    return this.activations.find();
  }

  /**
   * Activation explicite et journalisée. La téléphonie exige en PLUS
   * OUTBOUND_CALLS_ENABLED=true : activer ici seul ne suffit jamais.
   */
  @Roles('admin')
  @Post('activations/:key')
  async setActivation(
    @Param('key') key: string,
    @Req() req: { operator: { role: string } },
  ) {
    if (!/^[a-z_]{1,64}$/.test(key)) throw new Error('Clé invalide.');
    let row = await this.activations.findOne({ where: { key } });
    if (!row) row = this.activations.create({ key, active: false });
    row.active = !row.active;
    row.activatedBy = `operator:${req.operator.role}`;
    row.activatedAt = new Date();
    const saved = await this.activations.save(row);
    await this.audit.logOperatorAction(req.operator.role, 'activation.toggle', key, {
      active: saved.active,
    });
    return saved;
  }
}
