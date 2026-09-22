import { Module } from '@nestjs/common';
import { FloorMapService } from './floor-map.service';
import { OrganizationController } from './organization.controller';
import { OrganizationService } from './organization.service';

@Module({
  controllers: [OrganizationController],
  providers: [OrganizationService, FloorMapService],
  exports: [OrganizationService, FloorMapService],
})
export class OrganizationModule {}
