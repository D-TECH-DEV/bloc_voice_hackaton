import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SystemActivation } from '../entities/system-activation.entity';
import { TelephonySafetyService } from './telephony-safety.service';

@Module({
  imports: [TypeOrmModule.forFeature([SystemActivation])],
  providers: [TelephonySafetyService],
  exports: [TelephonySafetyService],
})
export class TelephonyModule {}
