import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ToolCatalogSearchDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  query!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  categoryId?: number;

  /** Session de conversation : la recherche y est enregistrée (traçabilité). */
  @IsOptional()
  @IsUUID()
  sessionId?: string;
}

export class ToolRecommendationItemDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  variantId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  ref?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(256)
  label!: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  qty?: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  unit?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(8)
  currency?: string;
}

export class ToolRecordRecommendationsDto {
  @IsUUID()
  sessionId!: string;

  @IsOptional()
  @IsUUID()
  searchId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ToolRecommendationItemDto)
  items!: ToolRecommendationItemDto[];
}

export class ToolConfirmSelectionsDto {
  @IsUUID()
  sessionId!: string;

  /** Produits proposés à confirmer (identifiants du récapitulatif de session). */
  @IsArray()
  @IsUUID(undefined, { each: true })
  itemIds!: string[];

  /** Accord explicite du client, exigé et vérifié. */
  @IsBoolean()
  confirmationClient!: boolean;
}

export class ToolEndConversationDto {
  @IsUUID()
  sessionId!: string;
}

export class ToolListItemDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  variantId?: number;

  @IsString()
  @MinLength(1)
  @MaxLength(256)
  label!: string;

  @IsNumber()
  @IsPositive()
  qty!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(32)
  unit!: string;
}

export class ToolPrepareListDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  customerRef!: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  projectRef?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ToolListItemDto)
  items!: ToolListItemDto[];
}

export class ToolConfirmRfqDto {
  @IsInt()
  @Min(1)
  organizationId!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ToolListItemDto)
  items!: ToolListItemDto[];

  /** Confirmation explicite du client, exigée et vérifiée. */
  @IsBoolean()
  confirmationClient!: boolean;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  idempotenceKey!: string;

  /** Session de conversation : la demande de devis y est rattachée (statut du récapitulatif). */
  @IsOptional()
  @IsUUID()
  sessionId?: string;
}

export class ToolOutcomeDto {
  @IsUUID()
  attemptId!: string;

  @IsIn(['completed', 'no_answer', 'failed', 'refused'])
  outcome!: 'completed' | 'no_answer' | 'failed' | 'refused';

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  summary!: string;
}

export class ToolOptOutDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  customerRef!: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  proofRef?: string;
}

export class ToolHandoffDto {
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
}
