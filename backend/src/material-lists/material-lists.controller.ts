import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  IsArray,
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
import { OperatorTokenGuard, Roles } from '../auth/operator-token.guard';
import { MaterialListsService } from './material-lists.service';

class ListItemDto {
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

class CreateListDto {
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
  @Type(() => ListItemDto)
  items!: ListItemDto[];
}

@ApiTags('material-lists')
@ApiBearerAuth()
@UseGuards(OperatorTokenGuard)
@Controller('api/v1/relance/material-lists')
export class MaterialListsController {
  constructor(private readonly lists: MaterialListsService) {}

  @Roles('admin', 'sales')
  @Post()
  create(@Body() dto: CreateListDto, @Req() req: { operator: { role: string } }) {
    return this.lists.create({
      customerRef: dto.customerRef,
      projectRef: dto.projectRef,
      items: dto.items.map((i) => ({ variantId: i.variantId, freeLabel: i.label, qty: i.qty, unit: i.unit })),
      createdBy: `operator:${req.operator.role}`,
    });
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.lists.getById(id);
  }

  /** Confirmation explicite : affiche résolu vs inconnu. N'est PAS une commande. */
  @Roles('admin', 'sales')
  @Post(':id/confirm')
  confirm(@Param('id') id: string, @Req() req: { operator: { role: string } }) {
    return this.lists.confirm(id, `operator:${req.operator.role}`);
  }
}

export class ListIdParam {
  @IsUUID()
  id!: string;
}
