import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { OperatorTokenGuard } from '../auth/operator-token.guard';
import { Roles } from '../auth/operator-token.guard';
import { conflict } from '../common/errors/api-error';
import { AuditService } from '../audit/audit.service';
import { BlokCoreClient } from '../core-integration/blok-core.client';
import {
  DecisionEngineService,
  type ConsentSight,
} from '../decision-engine/decision-engine.service';
import { TelephonySafetyService } from '../telephony/telephony-safety.service';
import { VoiceConsentsService } from '../voice-consents/voice-consents.service';
import { CallAttemptsService } from '../call-attempts/call-attempts.service';
import { OutreachTasksService } from './outreach-tasks.service';
import { CreateTaskDto, EvaluateTaskDto, TaskIdParam } from './tasks.dto';

@ApiTags('tasks')
@ApiBearerAuth()
@UseGuards(OperatorTokenGuard)
@Controller('api/v1/relance/tasks')
export class TasksController {
  constructor(
    private readonly tasks: OutreachTasksService,
    private readonly consents: VoiceConsentsService,
    private readonly engine: DecisionEngineService,
    private readonly audit: AuditService,
    private readonly telephony: TelephonySafetyService,
    private readonly core: BlokCoreClient,
    private readonly attempts: CallAttemptsService,
  ) {}

  @Get()
  list(@Query('status') status?: string) {
    return this.tasks.list({ status });
  }

  @Get(':id')
  get(@Param() params: TaskIdParam) {
    return this.tasks.getById(params.id);
  }

  @Roles('admin', 'sales')
  @Post()
  async create(@Body() dto: CreateTaskDto, @Req() req: { operator: { role: string } }) {
    const task = await this.tasks.create({
      customerRef: dto.customerRef,
      organizationId: dto.organizationId,
      kind: dto.kind,
      motive: dto.motive,
      coreRef: dto.coreRef,
      priority: dto.priority,
      dueAt: new Date(dto.dueAt),
      nextAction: dto.nextAction,
      idempotencyKey: dto.idempotencyKey,
    });
    await this.audit.logOperatorAction(req.operator.role, 'task.create', task.id, {
      customerRef: task.customerRef,
    });
    return task;
  }

  @Roles('admin', 'sales')
  @Post(':id/cancel')
  async cancel(@Param() params: TaskIdParam, @Req() req: { operator: { role: string } }) {
    const task = await this.tasks.transition(params.id, 'cancelled', req.operator.role);
    await this.audit.logOperatorAction(req.operator.role, 'task.cancel', task.id, undefined);
    return task;
  }

  /**
   * Évaluation déterministe (réévaluée avant toute tentative).
   * Une autorisation ici n'envoie RIEN : l'appel reste désactivé (voir TelephonyModule).
   */
  @Post(':id/evaluate')
  async evaluate(
    @Param() params: TaskIdParam,
    @Body() dto: EvaluateTaskDto,
    @Req() req: { operator: { role: string } },
  ) {
    const task = await this.tasks.getById(params.id);
    const consent = (await this.consents.getStatus(task.customerRef)) as ConsentSight;
    const attempts = await this.attempts.listForTask(task.id);
    const lastFinished = attempts.length > 0 ? attempts[attempts.length - 1]!.createdAt : null;
    const decision = this.engine.evaluate({
      taskId: task.id,
      taskStatus: task.status,
      attemptCount: task.attemptCount,
      lastAttemptAt: lastFinished,
      motive: task.motive,
      consent,
      identityVerified: dto.identityVerified === true,
      coreAvailable: !this.core.isMockMode(),
      telephonyActivated: await this.telephony.isActivated(),
      now: new Date(),
    });
    await this.audit.logDecision({
      taskId: task.id,
      decision: decision.allowed ? 'allow' : 'block',
      evaluatedAt: new Date(decision.evaluatedAt),
      ruleVersion: decision.ruleVersion,
      reasonCodes: decision.reasonCodes,
      facts: decision.facts,
      requestedBy: `operator:${req.operator.role}`,
    });
    await this.tasks.saveEvaluation(task.id, {
      allowed: decision.allowed,
      reasonCodes: decision.reasonCodes,
      ruleVersion: decision.ruleVersion,
      evaluatedAt: decision.evaluatedAt,
    });
    return decision;
  }

  @Get(':id/attempts')
  taskAttempts(@Param() params: TaskIdParam) {
    return this.attempts.listForTask(params.id);
  }

  @Get(':id/decisions')
  taskDecisions(@Param() params: TaskIdParam) {
    return this.audit.decisionsForTask(params.id);
  }

  @Roles('admin')
  @Patch(':id/priority')
  async setPriority(@Param() params: TaskIdParam, @Body() body: { priority: string }) {
    const task = await this.tasks.getById(params.id);
    if (!['low', 'normal', 'high'].includes(body.priority)) {
      throw conflict('Priorité invalide.');
    }
    task.priority = body.priority as 'low' | 'normal' | 'high';
    return this.tasks.saveEvaluation(task.id, task.lastEvaluation ?? {});
  }
}
