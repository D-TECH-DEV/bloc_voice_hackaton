import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MaterialList, MaterialListItem } from '../entities/material-list.entity';
import { MaterialListsService } from './material-lists.service';

@Module({
  imports: [TypeOrmModule.forFeature([MaterialList, MaterialListItem])],
  providers: [MaterialListsService],
  exports: [MaterialListsService],
})
export class MaterialListsModule {}
