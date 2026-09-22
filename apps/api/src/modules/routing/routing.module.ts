import { Module } from '@nestjs/common';
import { DISTANCE_PROVIDER, HaversineDistanceProvider } from './distance.provider';
import { RoutingService } from './routing.service';

@Module({
  providers: [
    RoutingService,
    { provide: DISTANCE_PROVIDER, useClass: HaversineDistanceProvider },
  ],
  exports: [RoutingService, DISTANCE_PROVIDER],
})
export class RoutingModule {}
