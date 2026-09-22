import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  AuditAction,
  CreateMissionInput,
  MissionDto,
  MissionStatus,
  MissionSummaryDto,
  MissionsQuery,
  PackageStatus,
  PaginatedResult,
  ReorderStopsInput,
  RouteSuggestionDto,
  StopStatus,
  StopType,
  TaskPriority,
  UpdateMissionInput,
  UserRole,
  isMissionEditable,
} from '@south/shared';
import {
  assertViewMission,
  canExecuteMission,
  canViewSecuredTransportNotes,
  isCommander,
  isSoldier,
} from '../../common/authz/access-control';
import { AppException } from '../../common/errors/app.exception';
import { PrismaService } from '../../common/prisma/prisma.service';
import { nextMissionNumber } from '../../common/utils/ids.util';
import { paginate, toSkipTake } from '../../common/utils/pagination.util';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { OrganizationService } from '../organization/organization.service';
import { HubBase, PickupCandidate, RoutingService } from '../routing/routing.service';
import {
  MissionDetailRow,
  missionDetailInclude,
  missionSummaryInclude,
  toMissionDetail,
  toMissionSummary,
} from './mission.mapper';

@Injectable()
export class MissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly routing: RoutingService,
    private readonly organization: OrganizationService,
    private readonly audit: AuditService,
  ) {}

  // ============================================================
  // קריאה
  // ============================================================

  async list(
    user: AuthenticatedUser,
    query: MissionsQuery,
  ): Promise<PaginatedResult<MissionSummaryDto>> {
    const where: Prisma.TransportMissionWhereInput = {
      status: query.status,
      assignedSoldierId: query.assignedSoldierId,
      stops: query.baseId ? { some: { baseId: query.baseId } } : undefined,
    };

    if (query.joinable) {
      where.status = MissionStatus.PLANNED;
      where.plannedDepartureAt = { gte: new Date() };
    }

    // NoCyberHere: AUTHORIZATION
    // Threat: חשיפת שליחויות שאינן קשורות למשתמש
    // Reason: חייל רואה רק שליחויות שלו או כאלה שעוברות בבסיס שלו; ראש צוות אינו מנהל שליחויות.
    if (user.role === UserRole.TEAM_LEAD) {
      throw new AppException('FORBIDDEN_ROLE');
    }
    if (user.role === UserRole.LOGISTICS_SOLDIER) {
      where.OR = [
        { assignedSoldierId: user.id },
        ...(user.baseId ? [{ stops: { some: { baseId: user.baseId } } }] : []),
      ];
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.transportMission.count({ where }),
      this.prisma.transportMission.findMany({
        where,
        include: missionSummaryInclude,
        relationLoadStrategy: 'join',
        orderBy: [{ plannedDepartureAt: 'asc' }],
        ...toSkipTake(query),
      }),
    ]);

    return paginate(rows.map(toMissionSummary), total, query);
  }

  async get(user: AuthenticatedUser, missionId: string): Promise<MissionDto> {
    const row = await this.loadMission(missionId);
    return this.toAuthorizedDetail(user, row);
  }

  /** הצעת מסלול לפני שמירת השליחות (§8.6). */
  async suggestRoute(packageIds: string[]): Promise<RouteSuggestionDto> {
    const { hub, pickups } = await this.buildRouteInputs(packageIds);
    return this.routing.suggest(hub, pickups);
  }

  // ============================================================
  // תכנון
  // ============================================================

  async create(user: AuthenticatedUser, input: CreateMissionInput): Promise<MissionDto> {
    const packages = await this.loadAssignablePackages(input.packageIds);
    const { hub, pickups } = await this.buildRouteInputs(input.packageIds);

    if (input.assignedSoldierId) {
      await this.assertSoldierExists(input.assignedSoldierId);
    }

    const plan = input.stopBaseOrder?.length
      ? this.planFromManualOrder(hub, pickups, input.stopBaseOrder)
      : this.routing.suggest(hub, pickups);

    const missionId = await this.prisma.$transaction(async (tx) => {
      const mission = await tx.transportMission.create({
        data: {
          missionNumber: await nextMissionNumber(tx),
          title: input.title,
          createdById: user.id,
          assignedSoldierId: input.assignedSoldierId ?? null,
          vehicleType: input.vehicleType,
          vehicleDetails: input.vehicleDetails ?? null,
          licensePlate: input.licensePlate ?? null,
          requiresSecuredTransport: input.requiresSecuredTransport,
          securedTransportNotes: input.requiresSecuredTransport
            ? (input.securedTransportNotes ?? null)
            : null,
          plannedDepartureAt: new Date(input.plannedDepartureAt),
          // שליחות עוברת ל-PLANNED רק כשיש אריזות, מסלול, זמן יציאה וחייל מבצע (§8.12).
          status: input.assignedSoldierId ? MissionStatus.PLANNED : MissionStatus.DRAFT,
          routeDistanceKmEstimate: plan.totalDistanceKm,
          routeDurationMinutesEstimate: plan.totalDurationMinutes,
          optimizationScore: plan.optimizationScore,
          routeExplanation: plan.explanation,
        },
      });

      const stopIdByBase = await this.createStops(tx, mission.id, plan, hub);

      for (const pkg of packages) {
        const stopId = stopIdByBase.get(pkg.sourceRoom.baseId);
        if (!stopId) throw new AppException('INVALID_STOP_ORDER');

        await tx.missionPackage.create({
          data: {
            transportMissionId: mission.id,
            packageId: pkg.id,
            pickupStopId: stopId,
          },
        });

        await tx.package.update({
          where: { id: pkg.id },
          data: { status: PackageStatus.ASSIGNED_TO_MISSION },
        });
        await tx.packageStatusEvent.create({
          data: {
            packageId: pkg.id,
            fromStatus: PackageStatus.READY_FOR_SHIPMENT,
            toStatus: PackageStatus.ASSIGNED_TO_MISSION,
            actorUserId: user.id,
            missionId: mission.id,
            note: `שובצה לשליחות ${mission.missionNumber}`,
          },
        });
      }

      await this.audit.record(
        {
          actorUserId: user.id,
          action: AuditAction.MISSION_CREATED,
          entityType: 'TransportMission',
          entityId: mission.id,
          after: {
            missionNumber: mission.missionNumber,
            packageCount: packages.length,
            stopCount: plan.stops.length,
            requiresSecuredTransport: input.requiresSecuredTransport,
          },
        },
        tx,
      );

      return mission.id;
    });

    return this.get(user, missionId);
  }

  async update(
    user: AuthenticatedUser,
    missionId: string,
    input: UpdateMissionInput,
  ): Promise<MissionDto> {
    const mission = await this.loadMission(missionId);
    this.assertEditable(mission);

    if (input.assignedSoldierId) await this.assertSoldierExists(input.assignedSoldierId);

    const requiresSecured = input.requiresSecuredTransport ?? mission.requiresSecuredTransport;
    const notes =
      input.securedTransportNotes === undefined
        ? mission.securedTransportNotes
        : input.securedTransportNotes;
    if (requiresSecured && !notes?.trim()) {
      throw new AppException('SECURED_TRANSPORT_NOTES_REQUIRED');
    }

    await this.prisma.$transaction(async (tx) => {
      const nextStatus =
        mission.status === MissionStatus.DRAFT &&
        (input.assignedSoldierId ?? mission.assignedSoldierId) &&
        mission.packages.length > 0
          ? MissionStatus.PLANNED
          : undefined;

      await tx.transportMission.update({
        where: { id: missionId },
        data: {
          title: input.title,
          plannedDepartureAt: input.plannedDepartureAt
            ? new Date(input.plannedDepartureAt)
            : undefined,
          vehicleType: input.vehicleType,
          vehicleDetails: input.vehicleDetails === null ? null : input.vehicleDetails,
          licensePlate: input.licensePlate === null ? null : input.licensePlate,
          assignedSoldierId:
            input.assignedSoldierId === null ? null : input.assignedSoldierId,
          requiresSecuredTransport: input.requiresSecuredTransport,
          securedTransportNotes: requiresSecured ? notes : null,
          status: nextStatus,
        },
      });

      await this.audit.record(
        {
          actorUserId: user.id,
          action: AuditAction.MISSION_UPDATED,
          entityType: 'TransportMission',
          entityId: missionId,
          before: {
            title: mission.title,
            plannedDepartureAt: mission.plannedDepartureAt,
            assignedSoldierId: mission.assignedSoldierId,
            requiresSecuredTransport: mission.requiresSecuredTransport,
          },
          after: input,
        },
        tx,
      );
    });

    return this.get(user, missionId);
  }

  async addPackages(
    user: AuthenticatedUser,
    missionId: string,
    packageIds: string[],
  ): Promise<MissionDto> {
    const mission = await this.loadMission(missionId);
    this.assertEditable(mission);

    const packages = await this.loadAssignablePackages(packageIds);

    await this.prisma.$transaction(async (tx) => {
      await this.attachPackages(tx, mission, packages, user.id);
      await this.recalculateRoute(tx, missionId, user.id);
      await this.audit.record(
        {
          actorUserId: user.id,
          action: AuditAction.MISSION_PACKAGES_ADDED,
          entityType: 'TransportMission',
          entityId: missionId,
          after: { packageCount: packages.length },
        },
        tx,
      );
    });

    return this.get(user, missionId);
  }

  async removePackage(
    user: AuthenticatedUser,
    missionId: string,
    packageId: string,
  ): Promise<MissionDto> {
    const mission = await this.loadMission(missionId);
    this.assertEditable(mission);

    const link = mission.packages.find((item) => item.packageId === packageId);
    if (!link) throw new AppException('PACKAGE_NOT_IN_MISSION');

    await this.prisma.$transaction(async (tx) => {
      await tx.missionPackage.delete({ where: { id: link.id } });

      // ביטול השיבוץ בלבד: האריזה נשארת סגורה ומאומתת וחוזרת לבריכת המוכנות.
      await tx.package.update({
        where: { id: packageId },
        data: { status: PackageStatus.READY_FOR_SHIPMENT },
      });
      await tx.packageStatusEvent.create({
        data: {
          packageId,
          fromStatus: PackageStatus.ASSIGNED_TO_MISSION,
          toStatus: PackageStatus.READY_FOR_SHIPMENT,
          actorUserId: user.id,
          missionId,
          note: 'הוסרה מהשליחות',
        },
      });

      await this.removeEmptyPickupStops(tx, missionId);
      await this.recalculateRoute(tx, missionId, user.id);

      await this.audit.record(
        {
          actorUserId: user.id,
          action: AuditAction.MISSION_PACKAGE_REMOVED,
          entityType: 'TransportMission',
          entityId: missionId,
          before: { packageId },
        },
        tx,
      );
    });

    return this.get(user, missionId);
  }

  /** שינוי ידני של סדר העצירות (§8.6.5). */
  async reorderStops(
    user: AuthenticatedUser,
    missionId: string,
    input: ReorderStopsInput,
  ): Promise<MissionDto> {
    const mission = await this.loadMission(missionId);
    this.assertEditable(mission);

    const existingIds = mission.stops.map((stop) => stop.id);
    if (
      input.stopIds.length !== existingIds.length ||
      !input.stopIds.every((id) => existingIds.includes(id))
    ) {
      throw new AppException('INVALID_STOP_ORDER');
    }

    const stopById = new Map(mission.stops.map((stop) => [stop.id, stop]));
    if (stopById.get(input.stopIds[0])?.stopType !== StopType.START) {
      throw new AppException('INVALID_STOP_ORDER');
    }
    const lastStop = stopById.get(input.stopIds[input.stopIds.length - 1]);
    if (lastStop?.stopType !== StopType.DELIVERY_HUB && lastStop?.stopType !== StopType.END) {
      throw new AppException('INVALID_STOP_ORDER');
    }

    await this.prisma.$transaction(async (tx) => {
      // שלב ביניים עם ערכים גבוהים, כדי לא להפר את אילוץ הייחודיות (missionId, sequence).
      for (const [index, stopId] of input.stopIds.entries()) {
        await tx.missionStop.update({
          where: { id: stopId },
          data: { sequence: 1000 + index },
        });
      }
      for (const [index, stopId] of input.stopIds.entries()) {
        await tx.missionStop.update({ where: { id: stopId }, data: { sequence: index } });
      }

      await this.recalculateRoute(tx, missionId, user.id, { manual: true });

      await this.audit.record(
        {
          actorUserId: user.id,
          action: AuditAction.MISSION_ROUTE_CHANGED,
          entityType: 'TransportMission',
          entityId: missionId,
          after: { stopOrder: input.stopIds },
        },
        tx,
      );
    });

    return this.get(user, missionId);
  }

  async cancel(user: AuthenticatedUser, missionId: string, reason?: string): Promise<MissionDto> {
    const mission = await this.loadMission(missionId);
    if (!isMissionEditable(mission.status as MissionStatus)) {
      throw new AppException('MISSION_INVALID_STATUS');
    }

    await this.prisma.$transaction(async (tx) => {
      for (const item of mission.packages) {
        await tx.package.update({
          where: { id: item.packageId },
          data: { status: PackageStatus.READY_FOR_SHIPMENT },
        });
        await tx.packageStatusEvent.create({
          data: {
            packageId: item.packageId,
            fromStatus: PackageStatus.ASSIGNED_TO_MISSION,
            toStatus: PackageStatus.READY_FOR_SHIPMENT,
            actorUserId: user.id,
            missionId,
            note: 'השליחות בוטלה',
          },
        });
      }
      await tx.missionPackage.deleteMany({ where: { transportMissionId: missionId } });
      await tx.transportMission.update({
        where: { id: missionId },
        data: { status: MissionStatus.CANCELLED },
      });
      await this.audit.record(
        {
          actorUserId: user.id,
          action: AuditAction.MISSION_CANCELLED,
          entityType: 'TransportMission',
          entityId: missionId,
          metadata: { reason: reason ?? null },
        },
        tx,
      );
    });

    return this.get(user, missionId);
  }

  // ============================================================
  // עזרים משותפים (בשימוש גם ע"י שירות הביצוע ובקשות ההצטרפות)
  // ============================================================

  async loadMission(missionId: string): Promise<MissionDetailRow> {
    const mission = await this.prisma.transportMission.findUnique({
      where: { id: missionId },
      include: missionDetailInclude,
      relationLoadStrategy: 'join',
    });
    if (!mission) throw new AppException('MISSION_NOT_FOUND');
    return mission;
  }

  async toAuthorizedDetail(
    user: AuthenticatedUser,
    row: MissionDetailRow,
  ): Promise<MissionDto> {
    const hubBaseId = await this.organization.hubBaseId();
    const scope = {
      assignedSoldierId: row.assignedSoldierId,
      createdById: row.createdById,
      stopBaseIds: row.stops.map((stop) => stop.baseId),
    };
    assertViewMission(user, scope, hubBaseId);

    return toMissionDetail(row, {
      canEdit: isCommander(user),
      canExecute: isCommander(user) || canExecuteMission(user, scope),
      canRequestJoin:
        isSoldier(user) &&
        Boolean(user.baseId) &&
        row.assignedSoldierId !== user.id &&
        !row.stops.some(
          (stop) => stop.baseId === user.baseId && stop.status !== StopStatus.PLANNED,
        ),
      canViewSecuredNotes: canViewSecuredTransportNotes(user, scope),
    });
  }

  assertEditable(mission: MissionDetailRow): void {
    if (!isMissionEditable(mission.status as MissionStatus)) {
      throw new AppException('MISSION_LOCKED');
    }
  }

  /** טוען אריזות שניתן לשבץ לשליחות ומוודא שאינן משויכות כבר. */
  async loadAssignablePackages(packageIds: string[]) {
    const packages = await this.prisma.package.findMany({
      where: { id: { in: packageIds } },
      include: {
        sourceRoom: { select: { baseId: true } },
        missionPackage: { select: { id: true } },
        task: { select: { priority: true } },
      },
    });

    if (packages.length !== packageIds.length) throw new AppException('PACKAGE_NOT_FOUND');

    for (const pkg of packages) {
      if (pkg.missionPackage) throw new AppException('PACKAGE_ALREADY_IN_MISSION');
      if (pkg.status !== PackageStatus.READY_FOR_SHIPMENT) {
        throw new AppException('PACKAGE_INVALID_STATUS');
      }
    }

    return packages;
  }

  /** משייך אריזות לשליחות קיימת, כולל יצירת עצירת איסוף חדשה אם צריך. */
  async attachPackages(
    tx: Prisma.TransactionClient,
    mission: MissionDetailRow,
    packages: Array<{ id: string; sourceRoom: { baseId: string } }>,
    actorUserId: string,
  ): Promise<void> {
    const stopIdByBase = new Map(
      mission.stops
        .filter((stop) => stop.stopType === StopType.PICKUP)
        .map((stop) => [stop.baseId, stop.id]),
    );

    const deliveryStop = mission.stops.find((stop) => stop.stopType === StopType.DELIVERY_HUB);
    let nextSequence = mission.stops.length;

    for (const pkg of packages) {
      let stopId = stopIdByBase.get(pkg.sourceRoom.baseId);

      if (!stopId) {
        // עצירת איסוף חדשה נוספת לפני עצירת הפריקה בקריית התקשוב.
        if (deliveryStop) {
          await tx.missionStop.update({
            where: { id: deliveryStop.id },
            data: { sequence: 1000 },
          });
        }
        const created = await tx.missionStop.create({
          data: {
            transportMissionId: mission.id,
            baseId: pkg.sourceRoom.baseId,
            sequence: nextSequence - 1,
            stopType: StopType.PICKUP,
            status: StopStatus.PLANNED,
          },
        });
        if (deliveryStop) {
          await tx.missionStop.update({
            where: { id: deliveryStop.id },
            data: { sequence: nextSequence },
          });
        }
        nextSequence += 1;
        stopId = created.id;
        stopIdByBase.set(pkg.sourceRoom.baseId, stopId);
      }

      await tx.missionPackage.create({
        data: {
          transportMissionId: mission.id,
          packageId: pkg.id,
          pickupStopId: stopId,
        },
      });
      await tx.package.update({
        where: { id: pkg.id },
        data: { status: PackageStatus.ASSIGNED_TO_MISSION },
      });
      await tx.packageStatusEvent.create({
        data: {
          packageId: pkg.id,
          fromStatus: PackageStatus.READY_FOR_SHIPMENT,
          toStatus: PackageStatus.ASSIGNED_TO_MISSION,
          actorUserId,
          missionId: mission.id,
          note: `שובצה לשליחות ${mission.missionNumber}`,
        },
      });
    }
  }

  /** מחיקת עצירות איסוף שנותרו בלי אריזות. */
  async removeEmptyPickupStops(
    tx: Prisma.TransactionClient,
    missionId: string,
  ): Promise<void> {
    const stops = await tx.missionStop.findMany({
      where: { transportMissionId: missionId, stopType: StopType.PICKUP },
      include: { packages: { select: { id: true } } },
    });
    const empty = stops.filter((stop) => stop.packages.length === 0);
    if (empty.length === 0) return;

    await tx.missionStop.deleteMany({ where: { id: { in: empty.map((stop) => stop.id) } } });

    const remaining = await tx.missionStop.findMany({
      where: { transportMissionId: missionId },
      orderBy: { sequence: 'asc' },
    });
    for (const [index, stop] of remaining.entries()) {
      await tx.missionStop.update({ where: { id: stop.id }, data: { sequence: 1000 + index } });
    }
    for (const [index, stop] of remaining.entries()) {
      await tx.missionStop.update({ where: { id: stop.id }, data: { sequence: index } });
    }
  }

  /** חישוב מחדש של מדדי המסלול לפי העצירות הנוכחיות. */
  async recalculateRoute(
    tx: Prisma.TransactionClient,
    missionId: string,
    _actorUserId: string,
    options: { manual?: boolean } = {},
  ): Promise<void> {
    const stops = await tx.missionStop.findMany({
      where: { transportMissionId: missionId },
      orderBy: { sequence: 'asc' },
      include: {
        base: true,
        packages: {
          include: { package: { include: { task: { select: { priority: true } } } } },
        },
      },
    });

    const hubStop = stops.find((stop) => stop.stopType === StopType.START) ?? stops[0];
    if (!hubStop) return;

    const hub: HubBase = {
      baseId: hubStop.baseId,
      baseCode: hubStop.base.code,
      baseName: hubStop.base.name,
      latitude: Number(hubStop.base.latitude),
      longitude: Number(hubStop.base.longitude),
    };

    const pickups: PickupCandidate[] = stops
      .filter((stop) => stop.stopType === StopType.PICKUP)
      .map((stop) => ({
        baseId: stop.baseId,
        baseCode: stop.base.code,
        baseName: stop.base.name,
        latitude: Number(stop.base.latitude),
        longitude: Number(stop.base.longitude),
        packageCount: stop.packages.length,
        highestPriority: highestPriority(
          stop.packages.map((item) => item.package.task.priority as TaskPriority),
        ),
        longestWaitHours: 0,
      }));

    const plan = options.manual
      ? this.routing.metricsForOrder(hub, pickups)
      : this.routing.suggest(hub, pickups);

    await tx.transportMission.update({
      where: { id: missionId },
      data: {
        routeDistanceKmEstimate: plan.totalDistanceKm,
        routeDurationMinutesEstimate: plan.totalDurationMinutes,
        optimizationScore: plan.optimizationScore,
        routeExplanation: plan.explanation,
      },
    });
  }

  private planFromManualOrder(
    hub: HubBase,
    pickups: PickupCandidate[],
    stopBaseOrder: string[],
  ): RouteSuggestionDto {
    const byBase = new Map(pickups.map((pickup) => [pickup.baseId, pickup]));
    const ordered: PickupCandidate[] = [];

    for (const baseId of stopBaseOrder) {
      const pickup = byBase.get(baseId);
      if (pickup) {
        ordered.push(pickup);
        byBase.delete(baseId);
      }
    }
    // בסיסים שלא נכללו בסדר הידני נוספים בסוף, כדי שלא תיעלם עצירה.
    ordered.push(...byBase.values());

    const metrics = this.routing.metricsForOrder(hub, ordered);
    return {
      stops: [
        {
          baseId: hub.baseId,
          baseCode: hub.baseCode,
          baseName: hub.baseName,
          stopType: StopType.START,
          sequence: 0,
          packageCount: 0,
          highestPriority: null,
          longestWaitHours: 0,
        },
        ...ordered.map((pickup, index) => ({
          baseId: pickup.baseId,
          baseCode: pickup.baseCode,
          baseName: pickup.baseName,
          stopType: StopType.PICKUP,
          sequence: index + 1,
          packageCount: pickup.packageCount,
          highestPriority: pickup.highestPriority,
          longestWaitHours: Math.round(pickup.longestWaitHours),
        })),
        {
          baseId: hub.baseId,
          baseCode: hub.baseCode,
          baseName: hub.baseName,
          stopType: StopType.DELIVERY_HUB,
          sequence: ordered.length + 1,
          packageCount: 0,
          highestPriority: null,
          longestWaitHours: 0,
        },
      ],
      legs: metrics.legs,
      totalDistanceKm: metrics.totalDistanceKm,
      totalDurationMinutes: metrics.totalDurationMinutes,
      optimizationScore: metrics.optimizationScore,
      explanation: metrics.explanation,
      estimatedTripsSaved: Math.max(0, ordered.length - 1),
    };
  }

  /** יוצר את עצירות השליחות לפי ההצעה ומחזיר מיפוי baseId -> stopId. */
  private async createStops(
    tx: Prisma.TransactionClient,
    missionId: string,
    plan: RouteSuggestionDto,
    hub: HubBase,
  ): Promise<Map<string, string>> {
    const stopIdByBase = new Map<string, string>();

    for (const stop of plan.stops) {
      const created = await tx.missionStop.create({
        data: {
          transportMissionId: missionId,
          baseId: stop.baseId,
          sequence: stop.sequence,
          stopType: stop.stopType,
          status: StopStatus.PLANNED,
        },
      });
      if (stop.stopType === StopType.PICKUP) {
        stopIdByBase.set(stop.baseId, created.id);
      }
    }

    // אריזות שמקורן בקריית התקשוב עצמה נאספות בעצירת ההתחלה.
    if (!stopIdByBase.has(hub.baseId)) {
      const startStop = plan.stops.find((stop) => stop.stopType === StopType.START);
      if (startStop) {
        const created = await tx.missionStop.findFirst({
          where: { transportMissionId: missionId, stopType: StopType.START },
        });
        if (created) stopIdByBase.set(hub.baseId, created.id);
      }
    }

    return stopIdByBase;
  }

  /** בונה את קלט אלגוריתם המסלול מתוך האריזות שנבחרו. */
  private async buildRouteInputs(
    packageIds: string[],
  ): Promise<{ hub: HubBase; pickups: PickupCandidate[] }> {
    const packages = await this.prisma.package.findMany({
      where: { id: { in: packageIds } },
      include: {
        sourceRoom: { select: { base: true } },
        task: { select: { priority: true } },
      },
    });
    if (packages.length === 0) throw new AppException('MISSION_REQUIRES_PACKAGES');

    const hubBase = await this.prisma.base.findFirst({ where: { isDestinationHub: true } });
    if (!hubBase) throw new AppException('BASE_NOT_FOUND');

    const hub: HubBase = {
      baseId: hubBase.id,
      baseCode: hubBase.code,
      baseName: hubBase.name,
      latitude: Number(hubBase.latitude),
      longitude: Number(hubBase.longitude),
    };

    const byBase = new Map<string, PickupCandidate>();
    const now = Date.now();

    for (const pkg of packages) {
      const base = pkg.sourceRoom.base;
      if (base.id === hubBase.id) continue; // אין עצירת איסוף נפרדת בבסיס היעד.

      const waitHours = pkg.sealedAt
        ? Math.max(0, (now - pkg.sealedAt.getTime()) / 3_600_000)
        : 0;

      const existing = byBase.get(base.id);
      if (existing) {
        existing.packageCount += 1;
        existing.highestPriority = highestPriority([
          existing.highestPriority,
          pkg.task.priority as TaskPriority,
        ]);
        existing.longestWaitHours = Math.max(existing.longestWaitHours, waitHours);
      } else {
        byBase.set(base.id, {
          baseId: base.id,
          baseCode: base.code,
          baseName: base.name,
          latitude: Number(base.latitude),
          longitude: Number(base.longitude),
          packageCount: 1,
          highestPriority: pkg.task.priority as TaskPriority,
          longestWaitHours: waitHours,
        });
      }
    }

    return { hub, pickups: [...byBase.values()] };
  }

  private async assertSoldierExists(userId: string): Promise<void> {
    const soldier = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!soldier || soldier.role !== UserRole.LOGISTICS_SOLDIER || !soldier.isActive) {
      throw new AppException('USER_NOT_FOUND');
    }
  }
}

const PRIORITY_ORDER: TaskPriority[] = [
  TaskPriority.LOW,
  TaskPriority.NORMAL,
  TaskPriority.HIGH,
  TaskPriority.URGENT,
];

export function highestPriority(
  priorities: Array<TaskPriority | null>,
): TaskPriority | null {
  let best: TaskPriority | null = null;
  for (const priority of priorities) {
    if (!priority) continue;
    if (!best || PRIORITY_ORDER.indexOf(priority) > PRIORITY_ORDER.indexOf(best)) {
      best = priority;
    }
  }
  return best;
}
