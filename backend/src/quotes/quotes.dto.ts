import { IsUUID } from 'class-validator';

export class FinalizeQuoteDto {
  /** Session vocale dont les sélections confirmées deviennent le devis. */
  @IsUUID()
  sessionId!: string;
}
