import { Module, forwardRef } from '@nestjs/common';
import { OrganizationModule } from '../organization/organization.module';
import { PackingTasksModule } from '../packing-tasks/packing-tasks.module';
import { PackagesController } from './packages.controller';
import { PackagesService } from './packages.service';

@Module({
  imports: [OrganizationModule, forwardRef(() => PackingTasksModule)],
  controllers: [PackagesController],
  providers: [PackagesService],
  exports: [PackagesService],
})
export class PackagesModule {}
