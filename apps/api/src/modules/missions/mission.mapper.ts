import { Prisma } from '@prisma/client';
import {
  JoinRequestDto,
  JoinRequestStatus,
  MissionDto,
  MissionPackageDto,
  MissionStatus,
  MissionStopDto,
  MissionSummaryDto,
  PackageStatus,
  StopStatus,
  StopType,
  VehicleType,
} from '@south/shared';
import { packageSummaryInclude, toPackageSummary } from '../packages/package.mapper';

export const missionSummaryInclude = {
  assignedSoldier: { select: { id: true, fullName: true } },
  stops: {
    orderBy: { sequence: 'asc' },
    include: { base: { select: { id: true, name: true, code: true } } },
  },
  packages: { select: { id: true, loadedAt: true, pickupStopId: true } },
} satisfies Prisma.TransportMissionInclude;

export type MissionSummaryRow = Prisma.TransportMissionGetPayload<{
  include: typeof missionSummaryInclude;
}>;

export const missionDetailInclude = {
  assignedSoldier: { select: { id: true, fullName: true } },
  createdBy: { select: { id: true, fullName: true } },
  stops: {
    orderBy: { sequence: 'asc' },
    include: { base: { select: { id: true, name: true, code: true } } },
  },
  packages: {
    include: { package: { include: packageSummaryInclude } },
  },
  joinRequests: { where: { status: JoinRequestStatus.PENDING }, select: { id: true } },
} satisfies Prisma.TransportMissionInclude;

export type MissionDetailRow = Prisma.TransportMissionGetPayload<{
  include: typeof missionDetailInclude;
}>;

export function toMissionSummary(row: MissionSummaryRow): MissionSummaryDto {
  const pickupStops = row.stops.filter((stop) => stop.stopType === StopType.PICKUP);
  return {
    id: row.id,
    missionNumber: row.missionNumber,
    title: row.title,
    status: row.status as MissionStatus,
    plannedDepartureAt: row.plannedDepartureAt.toISOString(),
    actualDepartureAt: row.actualDepartureAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    assignedSoldierId: row.assignedSoldierId,
    assignedSoldierName: row.assignedSoldier?.fullName ?? null,
    vehicleType: row.vehicleType as VehicleType,
    requiresSecuredTransport: row.requiresSecuredTransport,
    stopCount: row.stops.length,
    packageCount: row.packages.length,
    loadedPackageCount: row.packages.filter((item) => item.loadedAt).length,
    routeDistanceKmEstimate:
      row.routeDistanceKmEstimate !== null ? Number(row.routeDistanceKmEstimate) : null,
    routeDurationMinutesEstimate: row.routeDurationMinutesEstimate,
    pickupBaseNames: pickupStops.map((stop) => stop.base.name),
  };
}

export interface MissionPermissionContext {
  canEdit: boolean;
  canExecute: boolean;
  canRequestJoin: boolean;
  canViewSecuredNotes: boolean;
}

export function toMissionDetail(
  row: MissionDetailRow,
  permissions: MissionPermissionContext,
): MissionDto {
  const status = row.status as MissionStatus;

  const missionPackages: MissionPackageDto[] = row.packages.map((item) => {
    const summary = toPackageSummary(item.package);
    return {
      packageId: item.packageId,
      packageNumber: summary.packageNumber,
      status: summary.status as PackageStatus,
      teamName: summary.teamName,
      sourceRoomName: summary.sourceRoomName,
      destinationRoomName: summary.destinationRoomName,
      totalUnits: summary.totalUnits,
      pickupStopId: item.pickupStopId,
      loadedAt: item.loadedAt?.toISOString() ?? null,
      unloadedAt: item.unloadedAt?.toISOString() ?? null,
    };
  });

  const stops: MissionStopDto[] = row.stops.map((stop) => {
    const stopPackages = missionPackages.filter((item) => item.pickupStopId === stop.id);
    return {
      id: stop.id,
      baseId: stop.baseId,
      baseName: stop.base.name,
      baseCode: stop.base.code,
      sequence: stop.sequence,
      stopType: stop.stopType as StopType,
      status: stop.status as StopStatus,
      plannedAt: stop.plannedAt?.toISOString() ?? null,
      arrivedAt: stop.arrivedAt?.toISOString() ?? null,
      completedAt: stop.completedAt?.toISOString() ?? null,
      packages: stopPackages,
      plannedPackageCount: stopPackages.length,
      loadedPackageCount: stopPackages.filter((item) => item.loadedAt).length,
    };
  });

  const allLoaded =
    missionPackages.length > 0 && missionPackages.every((item) => item.loadedAt !== null);
  const allUnloaded =
    missionPackages.length > 0 && missionPackages.every((item) => item.unloadedAt !== null);

  return {
    ...toMissionSummary(row as unknown as MissionSummaryRow),
    createdById: row.createdById,
    createdByName: row.createdBy.fullName,
    vehicleDetails: row.vehicleDetails,
    licensePlate: row.licensePlate,
    // NoCyberHere: AUTHORIZATION
    // Threat: חשיפת הנחיות נסיעה מאובטחת למשתמש שאינו מורשה
    // Reason: השדה מוחזר רק למפקד ולחייל המבצע; לאחרים הוא null ולא מגיע כלל ללקוח.
    securedTransportNotes: permissions.canViewSecuredNotes ? row.securedTransportNotes : null,
    optimizationScore: row.optimizationScore !== null ? Number(row.optimizationScore) : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    stops,
    packages: missionPackages,
    routeExplanation: Array.isArray(row.routeExplanation)
      ? (row.routeExplanation as string[])
      : [],
    pendingJoinRequestCount: row.joinRequests.length,
    permissions: {
      canEdit: permissions.canEdit && (status === MissionStatus.DRAFT || status === MissionStatus.PLANNED),
      canManagePackages:
        permissions.canEdit && (status === MissionStatus.DRAFT || status === MissionStatus.PLANNED),
      canStartLoading: permissions.canExecute && status === MissionStatus.PLANNED,
      canDepart: permissions.canExecute && status === MissionStatus.LOADING && allLoaded,
      canUnload: permissions.canExecute && status === MissionStatus.IN_TRANSIT,
      canComplete: permissions.canExecute && status === MissionStatus.UNLOADING && allUnloaded,
      canCancel:
        permissions.canEdit && (status === MissionStatus.DRAFT || status === MissionStatus.PLANNED),
      canRequestJoin: permissions.canRequestJoin && status === MissionStatus.PLANNED,
    },
  };
}

export const joinRequestInclude = {
  mission: { select: { id: true, missionNumber: true, title: true } },
  requestingUser: { select: { id: true, fullName: true } },
  reviewedBy: { select: { id: true, fullName: true } },
  base: { select: { id: true, name: true } },
  packages: {
    include: {
      package: {
        select: {
          id: true,
          packageNumber: true,
          status: true,
          team: { select: { name: true } },
          assets: { select: { id: true } },
          bulkLines: { select: { quantity: true } },
        },
      },
    },
  },
} satisfies Prisma.MissionJoinRequestInclude;

export type JoinRequestRow = Prisma.MissionJoinRequestGetPayload<{
  include: typeof joinRequestInclude;
}>;

export function toJoinRequestDto(row: JoinRequestRow): JoinRequestDto {
  return {
    id: row.id,
    transportMissionId: row.transportMissionId,
    missionNumber: row.mission.missionNumber,
    missionTitle: row.mission.title,
    requestingUserId: row.requestingUserId,
    requestingUserName: row.requestingUser.fullName,
    baseId: row.baseId,
    baseName: row.base.name,
    status: row.status as JoinRequestStatus,
    note: row.note,
    packages: row.packages.map((item) => ({
      packageId: item.packageId,
      packageNumber: item.package.packageNumber,
      status: item.package.status as PackageStatus,
      totalUnits:
        item.package.assets.length +
        item.package.bulkLines.reduce((sum, line) => sum + line.quantity, 0),
      teamName: item.package.team.name,
    })),
    reviewedById: row.reviewedById,
    reviewedByName: row.reviewedBy?.fullName ?? null,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}
