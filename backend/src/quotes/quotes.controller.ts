import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { OperatorTokenGuard, Roles } from '../auth/operator-token.guard';
import { notFound } from '../common/errors/api-error';
import { FinalizeQuoteDto } from './quotes.dto';
import { QuotesService } from './quotes.service';

/**
 * Devis commerciaux issus des conversations vocales.
 * - Finalisation et lecture : réservées aux opérateurs (rôles admin/sales),
 *   appelées par le frontend via son relais same-origin (jeton jamais exposé).
 * - Téléchargement : route PUBLIQUE volontairement, protégée par le seul
 *   `downloadToken` imprédictible (64 hex) : aucune route par identifiant
 *   de session, 404 uniforme (aucun oracle sur l'existence d'un devis).
 */
@ApiTags('quotes')
@Controller('api/v1/relance/quotes')
export class QuotesController {
  constructor(private readonly quotes: QuotesService) {}

  /** Finalise le devis d'une session (idempotent : répéter renvoie l'existant). */
  @ApiBearerAuth()
  @UseGuards(OperatorTokenGuard)
  @Roles('admin', 'sales')
  @Post('from-session')
  @HttpCode(HttpStatus.CREATED)
  finalize(@Body() dto: FinalizeQuoteDto) {
    return this.quotes.finalizeSession(dto.sessionId);
  }

  /** Devis d'une session, ou état « non préparé » (scruté par le frontend). */
  @ApiBearerAuth()
  @UseGuards(OperatorTokenGuard)
  @Roles('admin', 'sales')
  @Get('by-session/:sessionId')
  bySession(@Param('sessionId', new ParseUUIDPipe()) sessionId: string) {
    return this.quotes.findBySession(sessionId);
  }

  /** Télécharge le PDF : seule la connaissance du jeton donne accès. */
  @Get('download/:token')
  async download(@Param('token') token: string, @Res({ passthrough: true }) res: Response) {
    const found = await this.quotes.getPdfByToken(token);
    if (!found) throw notFound('Devis introuvable.');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${found.filename}"`);
    res.setHeader('Content-Length', String(found.pdf.length));
    return this.sendPdf(res, found.pdf);
  }

  private sendPdf(res: Response, pdf: Buffer): void {
    res.send(pdf);
  }
}
