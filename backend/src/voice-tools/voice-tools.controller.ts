import { Body, Controller, Headers, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { randomUUID } from 'crypto';
import { VoiceToolGuard } from '../auth/voice-tool.guard';
import { CallAttemptsService } from '../call-attempts/call-attempts.service';
import { CatalogAdapter } from '../core-integration/catalog.adapter';
import { RfqAdapter } from '../core-integration/rfq.adapter';
import { HandoffsService } from '../handoffs/handoffs.service';
import { MaterialListsService } from '../material-lists/material-lists.service';
import { VoiceConsentsService } from '../voice-consents/voice-consents.service';
import { VoiceSessionsService } from '../voice-sessions/voice-sessions.service';
import { ApiError } from '../common/errors/api-error';
import {
  ToolCatalogSearchDto,
  ToolConfirmRfqDto,
  ToolConfirmSelectionsDto,
  ToolEndConversationDto,
  ToolHandoffDto,
  ToolOptOutDto,
  ToolOutcomeDto,
  ToolPrepareListDto,
  ToolRecordRecommendationsDto,
} from './voice-tools.dto';

/**
 * Outils HTTPS appelés par l'agent AethexAI (tool_type=function, headers
 * incluant `x-voice-tool-secret`). Allowlist fermée : 6 outils, aucun outil
 * d'appel sortant n'existe ni n'est exposé pendant cette phase.
 * Chaque réponse porte un identifiant de corrélation.
 */
@ApiTags('voice-tools')
@UseGuards(VoiceToolGuard)
@Controller('api/v1/relance/tools')
export class VoiceToolsController {
  constructor(
    private readonly catalog: CatalogAdapter,
    private readonly lists: MaterialListsService,
    private readonly rfq: RfqAdapter,
    private readonly attempts: CallAttemptsService,
    private readonly consents: VoiceConsentsService,
    private readonly handoffs: HandoffsService,
    private readonly sessions: VoiceSessionsService,
  ) {}

  private correlation(headers: Record<string, unknown>): string {
    const provided = headers['x-correlation-id'];
    return typeof provided === 'string' && provided.length > 0 ? provided : randomUUID();
  }

  @Post('catalog-search')
  async catalogSearch(@Body() dto: ToolCatalogSearchDto, @Headers() headers: Record<string, unknown>) {
    const result = await this.catalog.search(dto.query, { limit: 8, categoryId: dto.categoryId });
    let searchId: string | undefined;
    if (dto.sessionId) {
      const search = await this.sessions.recordSearch(dto.sessionId, dto.query, result);
      searchId = search.id;
    }
    return {
      correlationId: this.correlation(headers),
      ...result,
      sessionId: dto.sessionId ?? null,
      searchId: searchId ?? null,
      note: 'Prix et disponibilités non vérifiés quand les fanions valent false : les annoncer comme tels.',
    };
  }

  /**
   * Enregistre les produits effectivement présentés au client (recommandations).
   * Distinguer présenter ≠ sélectionner : rien n'est confirmé ici.
   */
  @Post('record-recommendations')
  async recordRecommendations(
    @Body() dto: ToolRecordRecommendationsDto,
    @Headers() headers: Record<string, unknown>,
  ) {
    const rows = await this.sessions.recordRecommendations(dto.sessionId, dto.items, dto.searchId);
    return {
      correlationId: this.correlation(headers),
      sessionId: dto.sessionId,
      recommandees: rows.length,
      itemIds: rows.map((r) => r.id),
      rappel: 'Produits proposés uniquement : une sélection exige la confirmation explicite du client.',
    };
  }

  /**
   * Confirme des produits proposés après accord explicite du client.
   * Sans confirmationClient=true : 422, rien n'est enregistré.
   */
  @Post('confirm-selections')
  async confirmSelections(
    @Body() dto: ToolConfirmSelectionsDto,
    @Headers() headers: Record<string, unknown>,
  ) {
    if (dto.confirmationClient !== true) {
      throw new ApiError(
        'VALIDATION_ERROR',
        'Sélection refusée : confirmation explicite du client requise.',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    const rows = await this.sessions.confirmSelections(dto.sessionId, dto.itemIds);
    return {
      correlationId: this.correlation(headers),
      sessionId: dto.sessionId,
      confirmees: rows.length,
      itemIds: rows.map((r) => r.id),
    };
  }

  /** Termine la conversation et fige le contexte (récapitulatif rejouable). */
  @Post('end-conversation')
  async endConversation(
    @Body() dto: ToolEndConversationDto,
    @Headers() headers: Record<string, unknown>,
  ) {
    const session = await this.sessions.endSession(dto.sessionId);
    const recap = await this.sessions.getRecap(dto.sessionId);
    return {
      correlationId: this.correlation(headers),
      sessionId: session.id,
      statut: session.status,
      resume: {
        proposees: recap.proposes.length,
        selectionnees: recap.selectionnes.length,
        totalEstime: recap.totalEstime,
        donneesSimulees: recap.donneesSimulees,
      },
    };
  }

  @Post('prepare-material-list')
  async prepareList(@Body() dto: ToolPrepareListDto, @Headers() headers: Record<string, unknown>) {
    const list = await this.lists.create({
      customerRef: dto.customerRef,
      projectRef: dto.projectRef,
      items: dto.items.map((i) => ({ variantId: i.variantId, freeLabel: i.label, qty: i.qty, unit: i.unit })),
      createdBy: 'tool:agent_vocal',
    });
    const full = await this.lists.getById(list.id);
    return {
      correlationId: this.correlation(headers),
      listId: full.id,
      statut: full.status,
      resolues: full.items.filter((i) => i.resolved).length,
      nonResolues: full.items.filter((i) => !i.resolved).length,
      rappel: "Un brouillon n'est ni un devis ni une commande.",
    };
  }

  @Post('confirm-rfq')
  async confirmRfq(@Body() dto: ToolConfirmRfqDto, @Headers() headers: Record<string, unknown>) {
    if (dto.confirmationClient !== true) {
      throw new ApiError(
        'VALIDATION_ERROR',
        'Création RFQ refusée : confirmation explicite du client requise.',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    const created = await this.rfq.create({
      organizationId: dto.organizationId,
      lines: dto.items.map((i) => ({ texte: i.label, variantId: i.variantId })),
      idempotenceKey: dto.idempotenceKey,
    });
    if (dto.sessionId && created.rfqNumber) {
      await this.sessions.linkRfq(dto.sessionId, created.rfqNumber, created.mock);
    }
    return {
      correlationId: this.correlation(headers),
      rfqNumber: created.rfqNumber,
      mock: created.mock,
      suivi: 'indisponible',
      sessionId: dto.sessionId ?? null,
    };
  }

  @Post('record-call-outcome')
  async recordOutcome(@Body() dto: ToolOutcomeDto, @Headers() headers: Record<string, unknown>) {
    const attempt = await this.attempts.recordOutcome({
      attemptId: dto.attemptId,
      outcome: dto.outcome,
      summary: dto.summary,
      reportedBy: 'tool:agent_vocal',
    });
    return { correlationId: this.correlation(headers), attemptId: attempt.id, outcome: attempt.outcome };
  }

  @Post('record-voice-opt-out')
  async recordOptOut(@Body() dto: ToolOptOutDto, @Headers() headers: Record<string, unknown>) {
    const consent = await this.consents.recordOptOut(
      dto.customerRef,
      'agent_vocal',
      'tool:agent_vocal',
      dto.proofRef,
    );
    return {
      correlationId: this.correlation(headers),
      customerRef: consent.customerRef,
      statut: consent.status,
      effet: 'immediat',
    };
  }

  @Post('request-human-handoff')
  async requestHandoff(@Body() dto: ToolHandoffDto, @Headers() headers: Record<string, unknown>) {
    const handoff = await this.handoffs.create(dto);
    return {
      correlationId: this.correlation(headers),
      handoffId: handoff.id,
      statut: handoff.status,
      rappel: 'Annoncer la transmission uniquement après cette réponse.',
    };
  }
}
