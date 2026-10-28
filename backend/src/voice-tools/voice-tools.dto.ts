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
