import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DecisionLog } from '../entities/decision-log.entity';
import { OperatorAction } from '../entities/operator-action.entity';
import { AuditService } from './audit.service';

@Module({
  imports: [TypeOrmModule.forFeature([DecisionLog, OperatorAction])],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
