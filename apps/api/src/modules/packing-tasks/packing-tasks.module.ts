import { Module, forwardRef } from '@nestjs/common';
import { PackagesModule } from '../packages/packages.module';
import { PackingTasksController } from './packing-tasks.controller';
import { PackingTasksService } from './packing-tasks.service';

@Module({
  imports: [forwardRef(() => PackagesModule)],
  controllers: [PackingTasksController],
  providers: [PackingTasksService],
  exports: [PackingTasksService],
})
export class PackingTasksModule {}
