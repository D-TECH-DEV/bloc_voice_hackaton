import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateTaskDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  customerRef!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  organizationId?: number;

  @IsIn(['rfq_followup', 'quote_followup', 'project_checkin', 'manual'])
  kind!: 'rfq_followup' | 'quote_followup' | 'project_checkin' | 'manual';

  @IsString()
  @MinLength(10)
  motive!: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  coreRef?: string;

  @IsOptional()
  @IsIn(['low', 'normal', 'high'])
  priority?: 'low' | 'normal' | 'high';

  @IsDateString()
  dueAt!: string;

  @IsOptional()
  @IsString()
  nextAction?: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  idempotencyKey!: string;
}

export class EvaluateTaskDto {
  /** Attestation opérateur : identité et numéro vérifiés par une source fiable. */
  @IsOptional()
  identityVerified?: boolean;
}

export class ListTasksQuery {
  @IsOptional()
  @IsIn(['pending', 'claimed', 'in_progress', 'done', 'cancelled', 'blocked', 'awaiting_human'])
  status?: string;

  @IsOptional()
  limit?: number;
}

export class TaskIdParam {
  @IsUUID()
  id!: string;
}
