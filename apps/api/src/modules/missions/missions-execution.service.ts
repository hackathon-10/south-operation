import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  AssetStatus,
  AuditAction,
  MissionDto,
  MissionStatus,
  PackageStatus,
  ScanActionInput,
  StopStatus,
  StopType,
  canTransitionMission,
} from '@south/shared';
import { canExecuteMission, isCommander } from '../../common/authz/access-control';
import { AppException } from '../../common/errors/app.exception';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { InventoryService } from '../inventory/inventory.service';
import { PackagesService } from '../packages/packages.service';
import { MissionDetailRow } from './mission.mapper';
import { MissionsService } from './missions.service';

/**
 * ביצוע השליחות בשטח: העמסה, יציאה, פריקה וקליטה (§8.8 - §8.9).
 * כל מעבר מצב עובר דרך Use Case ייעודי שבודק תנאים והרשאות.
 */
@Injectable()
export class MissionsExecutionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly missions: MissionsService,
    private readonly packages: PackagesService,
    private readonly inventory: InventoryService,
    private readonly audit: AuditService,
  ) {}

  async startLoading(user: AuthenticatedUser, missionId: string): Promise<MissionDto> {
    const mission = await this.missions.loadMission(missionId);
    this.assertExecutor(user, mission);

    if (mission.status === MissionStatus.LOADING) {
      return this.missions.toAuthorizedDetail(user, mission);
    }
    if (!canTransitionMission(mission.status as MissionStatus, MissionStatus.LOADING)) {
      throw new AppException('MISSION_INVALID_STATUS');
    }
    if (mission.packages.length === 0) throw new AppException('MISSION_REQUIRES_PACKAGES');
    if (!mission.assignedSoldierId) throw new AppException('MISSION_REQUIRES_SOLDIER');

    await this.prisma.$transaction(async (tx) => {
      await tx.transportMission.update({
        where: { id: missionId },
        data: { status: MissionStatus.LOADING },
      });
      await tx.missionStop.updateMany({
        where: { transportMissionId: missionId, stopType: StopType.START },
        data: { status: StopStatus.COMPLETED, arrivedAt: new Date(), completedAt: new Date() },
      });
      await this.audit.record(
        {
          actorUserId: user.id,
          action: AuditAction.MISSION_LOADING_STARTED,
          entityType: 'TransportMission',
          entityId: missionId,
        },
        tx,
      );
    });

    return this.missions.get(user, missionId);
  }

  async arriveAtStop(
    user: AuthenticatedUser,
    missionId: string,
    stopId: string,
  ): Promise<MissionDto> {
    const mission = await this.missions.loadMission(missionId);
    this.assertExecutor(user, mission);

    const stop = mission.stops.find((item) => item.id === stopId);
    if (!stop) throw new AppException('STOP_NOT_FOUND');

    if (
      mission.status !== MissionStatus.LOADING &&
      mission.status !== MissionStatus.IN_TRANSIT &&
      mission.status !== MissionStatus.UNLOADING
    ) {
      throw new AppException('MISSION_INVALID_STATUS');
    }

    if (stop.status === StopStatus.PLANNED) {
      await this.prisma.$transaction(async (tx) => {
        await tx.missionStop.update({
          where: { id: stopId },
          data: { status: StopStatus.ARRIVED, arrivedAt: new Date() },
        });
        await this.audit.record(
          {
            actorUserId: user.id,
            action: AuditAction.MISSION_STOP_ARRIVED,
            entityType: 'MissionStop',
            entityId: stopId,
            metadata: { missionId, baseId: stop.baseId },
          },
          tx,
        );
      });
    }

    return this.missions.get(user, missionId);
  }

  /** סימון אריזה כהועמסה. סריקה חוזרת לא תיצור העמסה כפולה. */
  async loadPackage(
    user: AuthenticatedUser,
    missionId: string,
    packageId: string,
    input: ScanActionInput = {},
  ): Promise<MissionDto> {
    const mission = await this.missions.loadMission(missionId);
    this.assertExecutor(user, mission);

    if (mission.status !== MissionStatus.LOADING) {
      throw new AppException('MISSION_INVALID_STATUS');
    }

    const link = mission.packages.find((item) => item.packageId === packageId);
    if (!link) throw new AppException('PACKAGE_NOT_IN_MISSION');
    if (link.loadedAt) throw new AppException('PACKAGE_ALREADY_LOADED');

    const stop = mission.stops.find((item) => item.id === link.pickupStopId);
    if (!stop) throw new AppException('STOP_NOT_FOUND');
    if (stop.status === StopStatus.PLANNED) throw new AppException('STOP_NOT_ARRIVED');

    await this.prisma.$transaction(async (tx) => {
      const result = await tx.missionPackage.updateMany({
        where: { id: link.id, loadedAt: null },
        data: { loadedAt: new Date(), loadedById: user.id },
      });
      // עדכון מותנה: אם בקשה מקבילה כבר סימנה העמסה, לא מבצעים פעולה נוספת.
      if (result.count === 0) return;

      await this.completeStopIfAllLoaded(tx, stop.id);

      await this.audit.record(
        {
          actorUserId: user.id,
          action: AuditAction.MISSION_PACKAGE_LOADED,
          entityType: 'Package',
          entityId: packageId,
          metadata: { missionId, stopId: stop.id, note: input.note ?? null },
        },
        tx,
      );
    });

    return this.missions.get(user, missionId);
  }

  /** יציאה לדרך: כל האריזות עוברות ל-IN_TRANSIT ותכולתן ננעלת (§8.8.6). */
  async depart(user: AuthenticatedUser, missionId: string): Promise<MissionDto> {
    const mission = await this.missions.loadMission(missionId);
    this.assertExecutor(user, mission);

    if (!canTransitionMission(mission.status as MissionStatus, MissionStatus.IN_TRANSIT)) {
      throw new AppException('MISSION_INVALID_STATUS');
    }

    const notLoaded = mission.packages.filter((item) => !item.loadedAt);
    if (notLoaded.length > 0) throw new AppException('MISSION_NOT_ALL_LOADED');

    await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      await tx.transportMission.update({
        where: { id: missionId },
        data: { status: MissionStatus.IN_TRANSIT, actualDepartureAt: now },
      });

      await tx.missionStop.updateMany({
        where: { transportMissionId: missionId, stopType: StopType.PICKUP },
        data: { status: StopStatus.COMPLETED, completedAt: now },
      });

      for (const item of mission.packages) {
        await tx.package.update({
          where: { id: item.packageId },
          data: { status: PackageStatus.IN_TRANSIT, departedAt: now },
        });
        await tx.packageStatusEvent.create({
          data: {
            packageId: item.packageId,
            fromStatus: PackageStatus.ASSIGNED_TO_MISSION,
            toStatus: PackageStatus.IN_TRANSIT,
            actorUserId: user.id,
            missionId,
            note: 'השליחות יצאה לדרך. תכולת האריזה נעולה',
          },
        });
        await this.inventory.setAssetsStatusForPackage(
          tx,
          item.packageId,
          AssetStatus.IN_TRANSIT,
        );
      }

      await this.audit.record(
        {
          actorUserId: user.id,
          action: AuditAction.MISSION_DEPARTED,
          entityType: 'TransportMission',
          entityId: missionId,
          after: { packageCount: mission.packages.length },
        },
        tx,
      );
    });

    return this.missions.get(user, missionId);
  }

  async startUnloading(user: AuthenticatedUser, missionId: string): Promise<MissionDto> {
    const mission = await this.missions.loadMission(missionId);
    this.assertExecutor(user, mission);

    if (mission.status === MissionStatus.UNLOADING) {
      return this.missions.toAuthorizedDetail(user, mission);
    }
    if (!canTransitionMission(mission.status as MissionStatus, MissionStatus.UNLOADING)) {
      throw new AppException('MISSION_INVALID_STATUS');
    }

    const deliveryStop = mission.stops.find((stop) => stop.stopType === StopType.DELIVERY_HUB);

    await this.prisma.$transaction(async (tx) => {
      await tx.transportMission.update({
        where: { id: missionId },
        data: { status: MissionStatus.UNLOADING },
      });
      if (deliveryStop) {
        await tx.missionStop.update({
          where: { id: deliveryStop.id },
          data: { status: StopStatus.ARRIVED, arrivedAt: new Date() },
        });
      }
      await this.audit.record(
        {
          actorUserId: user.id,
          action: AuditAction.MISSION_UNLOADING_STARTED,
          entityType: 'TransportMission',
          entityId: missionId,
        },
        tx,
      );
    });

    return this.missions.get(user, missionId);
  }

  /** פריקה וקליטה של אריזה בקריית התקשוב. */
  async unloadPackage(
    user: AuthenticatedUser,
    missionId: string,
    packageId: string,
    input: ScanActionInput = {},
  ): Promise<MissionDto> {
    const mission = await this.missions.loadMission(missionId);
    this.assertExecutor(user, mission);

    if (mission.status !== MissionStatus.UNLOADING && mission.status !== MissionStatus.IN_TRANSIT) {
      throw new AppException('MISSION_INVALID_STATUS');
    }

    const link = mission.packages.find((item) => item.packageId === packageId);
    if (!link) throw new AppException('PACKAGE_NOT_IN_MISSION');

    // הקליטה עצמה מתבצעת בשירות האריזות, כדי לשמור מקור אמת אחד למעבר הסטטוס.
    await this.packages.receive(user, packageId, input);

    await this.audit.record({
      actorUserId: user.id,
      action: AuditAction.MISSION_PACKAGE_UNLOADED,
      entityType: 'Package',
      entityId: packageId,
      metadata: { missionId },
    });

    return this.missions.get(user, missionId);
  }

  async complete(user: AuthenticatedUser, missionId: string): Promise<MissionDto> {
    const mission = await this.missions.loadMission(missionId);
    this.assertExecutor(user, mission);

    if (!canTransitionMission(mission.status as MissionStatus, MissionStatus.COMPLETED)) {
      throw new AppException('MISSION_INVALID_STATUS');
    }

    const pending = mission.packages.filter((item) => !item.unloadedAt);
    if (pending.length > 0) throw new AppException('MISSION_NOT_ALL_UNLOADED');

    await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      await tx.transportMission.update({
        where: { id: missionId },
        data: { status: MissionStatus.COMPLETED, completedAt: now },
      });
      await tx.missionStop.updateMany({
        where: { transportMissionId: missionId, stopType: StopType.DELIVERY_HUB },
        data: { status: StopStatus.COMPLETED, completedAt: now },
      });
      await this.audit.record(
        {
          actorUserId: user.id,
          action: AuditAction.MISSION_COMPLETED,
          entityType: 'TransportMission',
          entityId: missionId,
        },
        tx,
      );
    });

    return this.missions.get(user, missionId);
  }

  private async completeStopIfAllLoaded(
    tx: Prisma.TransactionClient,
    stopId: string,
  ): Promise<void> {
    const remaining = await tx.missionPackage.count({
      where: { pickupStopId: stopId, loadedAt: null },
    });
    if (remaining === 0) {
      await tx.missionStop.update({
        where: { id: stopId },
        data: { status: StopStatus.COMPLETED, completedAt: new Date() },
      });
    }
  }

  /**
   * NoCyberHere: AUTHORIZATION
   * Threat: חייל שאינו המבצע מנסה לבצע פעולות שטח על שליחות של אחר
   * Reason: פעולות ביצוע מותרות רק לחייל המשויך לשליחות (או למפקד לוגיסטיקה).
   */
  private assertExecutor(user: AuthenticatedUser, mission: MissionDetailRow): void {
    const scope = {
      assignedSoldierId: mission.assignedSoldierId,
      createdById: mission.createdById,
      stopBaseIds: mission.stops.map((stop) => stop.baseId),
    };
    if (isCommander(user)) return;
    if (!canExecuteMission(user, scope)) throw new AppException('FORBIDDEN_MISSION_SCOPE');
  }
}
