import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OutreachTask } from '../entities/outreach-task.entity';
import { OutreachTasksService } from './outreach-tasks.service';

@Module({
  imports: [TypeOrmModule.forFeature([OutreachTask])],
  providers: [OutreachTasksService],
  exports: [OutreachTasksService],
})
export class OutreachTasksModule {}
