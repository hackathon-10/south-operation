import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppConfigModule } from './common/config/config.module';
import { PrismaModule } from './common/prisma/prisma.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard, RolesGuard } from './modules/auth/guards';
import { CatalogModule } from './modules/catalog/catalog.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { HealthModule } from './modules/health/health.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { MissionsModule } from './modules/missions/missions.module';
import { OrganizationModule } from './modules/organization/organization.module';
import { PackagesModule } from './modules/packages/packages.module';
import { PackingTasksModule } from './modules/packing-tasks/packing-tasks.module';
import { RoutingModule } from './modules/routing/routing.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    AppConfigModule,
    /**
     * NoCyberHere: RATE_LIMITING
     * Threat: Brute force, Enumeration וניצול יתר של ה-API
     * Reason: מגבלה גלובלית, ומגבלות הדוקות יותר בנתיבי התחברות וסריקה.
     */
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 240 },
      { name: 'auth', ttl: 900_000, limit: 10 },
      { name: 'scan', ttl: 60_000, limit: 60 },
    ]),
    PrismaModule,
    AuditModule,
    AuthModule,
    UsersModule,
    InventoryModule,
    OrganizationModule,
    CatalogModule,
    PackingTasksModule,
    PackagesModule,
    RoutingModule,
    MissionsModule,
    DashboardModule,
    HealthModule,
  ],
  providers: [
    // סדר ה-Guards: הגבלת קצב -> אימות -> הרשאת תפקיד.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
