import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { SystemActivation } from '../entities/system-activation.entity';
import { AdminController } from './admin.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SystemActivation]), AuditModule],
  controllers: [AdminController],
})
export class AdminModule {}
