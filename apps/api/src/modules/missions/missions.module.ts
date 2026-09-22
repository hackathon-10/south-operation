import { Module } from '@nestjs/common';
import { OrganizationModule } from '../organization/organization.module';
import { PackagesModule } from '../packages/packages.module';
import { RoutingModule } from '../routing/routing.module';
import { JoinRequestsController } from './join-requests.controller';
import { JoinRequestsService } from './join-requests.service';
import { MissionsController } from './missions.controller';
import { MissionsExecutionService } from './missions-execution.service';
import { MissionsService } from './missions.service';

@Module({
  imports: [RoutingModule, OrganizationModule, PackagesModule],
  controllers: [MissionsController, JoinRequestsController],
  providers: [MissionsService, MissionsExecutionService, JoinRequestsService],
  exports: [MissionsService],
})
export class MissionsModule {}
