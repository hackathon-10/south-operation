import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  FLOOR_MAP_LAYOUT,
  FloorMapDetailsDto,
  FloorMapRoomShapeDto,
  FloorMapSummaryDto,
  PackageStatus,
  PackingTaskStatus,
  RoomMapSearchHitDto,
  RoomMapState,
  RoomPanelDto,
  UserRole,
} from '@south/shared';
import { AppException } from '../../common/errors/app.exception';
import { PrismaService } from '../../common/prisma/prisma.service';
import { OrganizationService, toRoomDto } from './organization.service';
import { toPackageSummary, packageSummaryInclude } from '../packages/package.mapper';
import { toTaskSummary, taskSummaryInclude } from '../packing-tasks/packing-task.mapper';
import type { AuthenticatedUser } from '../auth/auth.types';
import { canViewRoom, isCommander, isOperationManager, isSoldier, isTeamLead } from '../../common/authz/access-control';

const ACTIVE_TASK_STATUSES: PackingTaskStatus[] = [
  PackingTaskStatus.ASSIGNED,
  PackingTaskStatus.IN_PROGRESS,
];
const INCOMING_PACKAGE_STATUSES: PackageStatus[] = [
  PackageStatus.ASSIGNED_TO_MISSION,
  PackageStatus.IN_TRANSIT,
  PackageStatus.RECEIVED_AT_HUB,
];

/**
 * מפת החדרים האינטראקטיבית.
 * המפה היא Layout מבוסס נתונים: הצורות נשמרות ב-RoomMapShape,
 * והתוכן נשלף בזמן אמת מ-RoomInventory, AssetInstance, PackingTask ו-Package.
 */
@Injectable()
export class FloorMapService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organization: OrganizationService,
  ) {}

  async listFloorMaps(
    user: AuthenticatedUser,
    filter: { baseId?: string; building?: string },
  ): Promise<FloorMapSummaryDto[]> {
    const effectiveBaseId =
      isCommander(user) || isOperationManager(user)
        ? filter.baseId
        : user.baseId ?? filter.baseId;

    const maps = await this.prisma.floorMap.findMany({
      where: {
        baseId: effectiveBaseId,
        building: filter.building,
        ...(isTeamLead(user) || isSoldier(user)) && !isCommander(user) && !isOperationManager(user)
          ? { baseId: user.baseId ?? filter.baseId }
          : {},
      },
      orderBy: [{ building: 'asc' }, { floorNumber: 'asc' }],
    });
    return maps.map(toFloorMapSummary);
  }

  async floorMapDetails(user: AuthenticatedUser, floorMapId: string): Promise<FloorMapDetailsDto> {
    const map = await this.prisma.floorMap.findUnique({
      where: { id: floorMapId },
      include: {
        shapes: {
          include: {
            room: {
              include: { team: { select: { id: true, name: true } } },
            },
          },
          orderBy: { room: { roomNumber: 'asc' } },
        },
      },
    });
    if (!map) throw new AppException('FLOOR_MAP_NOT_FOUND');

    const hubBaseId = await this.organization.hubBaseId();
    const allowedRoomIds = map.shapes
      .filter((shape) => canViewRoom(user, { baseId: shape.room.baseId, teamId: shape.room.teamId }, hubBaseId))
      .map((shape) => shape.roomId);
    if (!isCommander(user) && !isOperationManager(user) && allowedRoomIds.length === 0) {
      throw new AppException('FORBIDDEN_BASE_SCOPE');
    }

    const roomIds = map.shapes
      .filter(
        (shape) =>
          isCommander(user) ||
          isOperationManager(user) ||
          allowedRoomIds.includes(shape.roomId),
      )
      .map((shape) => shape.roomId);
    const aggregates = await this.roomAggregates(roomIds);

    const rooms: FloorMapRoomShapeDto[] = map.shapes.map((shape) => {
      const stats = aggregates.get(shape.roomId) ?? emptyAggregate();
      return {
        shapeId: shape.id,
        roomId: shape.roomId,
        roomNumber: shape.room.roomNumber,
        displayName: shape.room.displayName,
        teamId: shape.room.teamId,
        teamName: shape.room.team?.name ?? null,
        x: shape.x,
        y: shape.y,
        width: shape.width,
        height: shape.height,
        doorSide: shape.doorSide as FloorMapRoomShapeDto['doorSide'],
        zone: shape.zone,
        totalUnits: stats.bulkUnits + stats.assetCount,
        assetCount: stats.assetCount,
        activeTaskCount: stats.activeTaskCount,
        incomingPackageCount: stats.incomingPackageCount,
        arrivedPackageCount: stats.arrivedPackageCount,
        state: computeRoomState(stats),
      };
    });

    return {
      map: toFloorMapSummary(map),
      corridor: { ...FLOOR_MAP_LAYOUT.corridor },
      rooms,
    };
  }

  /**
   * חיפוש חוצה-מפה: מספר חדר, שם חדר, צוות, בעלים, assetTag או מק״ט.
   * התוצאה מפנה לקומה הנכונה ומדגישה את החדר.
   */
  async searchRoomMap(
    user: AuthenticatedUser,
    params: {
      baseId?: string;
      building?: string;
      query: string;
    },
  ): Promise<RoomMapSearchHitDto[]> {
    const search = params.query.trim();
    const roomFilter: Prisma.RoomWhereInput = {
      baseId:
        isCommander(user) || isOperationManager(user)
          ? params.baseId
          : params.baseId ?? (isTeamLead(user) || isSoldier(user) ? user.baseId ?? undefined : undefined),
      building: params.building,
      floorMapId: { not: null },
      isActive: true,
    };

    const [rooms, assets, inventory] = await Promise.all([
      this.prisma.room.findMany({
        where: {
          ...roomFilter,
          OR: [
            { roomNumber: { contains: search, mode: 'insensitive' } },
            { displayName: { contains: search, mode: 'insensitive' } },
            { team: { name: { contains: search, mode: 'insensitive' } } },
          ],
        },
        include: { team: { select: { name: true } }, floorMap: { select: { floorNumber: true } } },
        take: 20,
      }),
      this.prisma.assetInstance.findMany({
        where: {
          currentRoom: roomFilter,
          OR: [
            { assetTag: { contains: search, mode: 'insensitive' } },
            { ownerName: { contains: search, mode: 'insensitive' } },
          ],
        },
        include: {
          currentRoom: {
            include: { floorMap: { select: { floorNumber: true } } },
          },
        },
        take: 20,
      }),
      this.prisma.roomInventory.findMany({
        where: {
          room: roomFilter,
          product: { sku: { contains: search, mode: 'insensitive' } },
          mappedQuantity: { gt: 0 },
        },
        include: {
          product: { select: { sku: true } },
          room: { include: { floorMap: { select: { floorNumber: true } } } },
        },
        take: 20,
      }),
    ]);

    const hits: RoomMapSearchHitDto[] = [];

    for (const room of rooms) {
      const matchedOnTeam =
        room.team?.name?.toLowerCase().includes(search.toLowerCase()) ?? false;
      hits.push({
        roomId: room.id,
        roomNumber: room.roomNumber,
        displayName: room.displayName,
        floorNumber: room.floorMap?.floorNumber ?? (Number(room.floor) || 0),
        floorMapId: room.floorMapId!,
        matchedOn: matchedOnTeam ? 'TEAM' : 'ROOM',
        matchedValue: matchedOnTeam ? (room.team?.name ?? '') : room.displayName,
      });
    }

    for (const asset of assets) {
      if (!asset.currentRoom?.floorMapId) continue;
      const matchedOnTag = asset.assetTag.toLowerCase().includes(search.toLowerCase());
      hits.push({
        roomId: asset.currentRoom.id,
        roomNumber: asset.currentRoom.roomNumber,
        displayName: asset.currentRoom.displayName,
        floorNumber: asset.currentRoom.floorMap?.floorNumber ?? 0,
        floorMapId: asset.currentRoom.floorMapId,
        matchedOn: matchedOnTag ? 'ASSET_TAG' : 'OWNER',
        matchedValue: matchedOnTag ? asset.assetTag : asset.ownerName,
      });
    }

    for (const line of inventory) {
      if (!line.room.floorMapId) continue;
      hits.push({
        roomId: line.roomId,
        roomNumber: line.room.roomNumber,
        displayName: line.room.displayName,
        floorNumber: line.room.floorMap?.floorNumber ?? 0,
        floorMapId: line.room.floorMapId,
        matchedOn: 'SKU',
        matchedValue: line.product.sku,
      });
    }

    // מסננים כפילויות לפי חדר + סוג התאמה.
    const unique = new Map<string, RoomMapSearchHitDto>();
    for (const hit of hits) {
      const key = `${hit.roomId}:${hit.matchedOn}:${hit.matchedValue}`;
      if (!unique.has(key)) unique.set(key, hit);
    }
    return [...unique.values()].slice(0, 25);
  }

  /** פאנל פרטי חדר - נפתח בלחיצה על חדר במפה. */
  async roomPanel(user: AuthenticatedUser, roomId: string): Promise<RoomPanelDto> {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      include: {
        base: { select: { id: true, name: true } },
        team: { select: { id: true, name: true, lead: { select: { fullName: true } } } },
      },
    });
    if (!room) throw new AppException('ROOM_NOT_FOUND');
    const hubBaseId = await this.organization.hubBaseId();
    if (!canViewRoom(user, { baseId: room.baseId, teamId: room.teamId }, hubBaseId)) {
      throw new AppException('FORBIDDEN_BASE_SCOPE');
    }
    const inventory = await this.organization.roomInventory(user, roomId);

    const [tasks, incoming, arrived] = await Promise.all([
      this.prisma.packingTask.findMany({
        where: {
          status: { in: ACTIVE_TASK_STATUSES },
          OR: [{ destinationRoomId: roomId }, { sourceRoomId: roomId }],
        },
        include: taskSummaryInclude,
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      this.prisma.package.findMany({
        where: { destinationRoomId: roomId, status: { in: INCOMING_PACKAGE_STATUSES } },
        include: packageSummaryInclude,
        orderBy: { updatedAt: 'desc' },
        take: 20,
      }),
      this.prisma.package.findMany({
        where: { destinationRoomId: roomId, status: PackageStatus.DELIVERED_TO_ROOM },
        include: packageSummaryInclude,
        orderBy: { deliveredAt: 'desc' },
        take: 20,
      }),
    ]);

    const aggregates = await this.roomAggregates([roomId]);
    const stats = aggregates.get(roomId) ?? emptyAggregate();

    return {
      room: toRoomDto(room),
      teamName: room.team?.name ?? null,
      leadUserName: room.team?.lead?.fullName ?? null,
      bulkLines: inventory.bulkLines,
      assets: inventory.assets,
      activeTasks: tasks.map(toTaskSummary),
      incomingPackages: incoming.map(toPackageSummary),
      arrivedPackages: arrived.map(toPackageSummary),
      state: computeRoomState(stats),
      totals: inventory.totals,
    };
  }

  /**
   * צובר נתונים לכל החדרים בקומה בחמש שאילתות בלבד (הימנעות מ-N+1, §16).
   */
  private async roomAggregates(roomIds: string[]): Promise<Map<string, RoomAggregate>> {
    const result = new Map<string, RoomAggregate>();
    if (roomIds.length === 0) return result;

    const [inventory, assets, destinationTasks, sourceTasks, packages] = await Promise.all([
      this.prisma.roomInventory.groupBy({
        by: ['roomId'],
        where: { roomId: { in: roomIds } },
        _sum: { mappedQuantity: true },
      }),
      this.prisma.assetInstance.groupBy({
        by: ['currentRoomId'],
        where: { currentRoomId: { in: roomIds } },
        _count: { _all: true },
      }),
      this.prisma.packingTask.groupBy({
        by: ['destinationRoomId'],
        where: { destinationRoomId: { in: roomIds }, status: { in: ACTIVE_TASK_STATUSES } },
        _count: { _all: true },
      }),
      this.prisma.packingTask.groupBy({
        by: ['sourceRoomId'],
        where: { sourceRoomId: { in: roomIds }, status: { in: ACTIVE_TASK_STATUSES } },
        _count: { _all: true },
      }),
      this.prisma.package.groupBy({
        by: ['destinationRoomId', 'status'],
        where: { destinationRoomId: { in: roomIds } },
        _count: { _all: true },
      }),
    ]);

    const ensure = (roomId: string): RoomAggregate => {
      const existing = result.get(roomId);
      if (existing) return existing;
      const created = emptyAggregate();
      result.set(roomId, created);
      return created;
    };

    for (const row of inventory) ensure(row.roomId).bulkUnits = row._sum.mappedQuantity ?? 0;
    for (const row of assets) {
      if (row.currentRoomId) ensure(row.currentRoomId).assetCount = row._count._all;
    }
    for (const row of destinationTasks) ensure(row.destinationRoomId).activeTaskCount += row._count._all;
    for (const row of sourceTasks) ensure(row.sourceRoomId).activeTaskCount += row._count._all;
    for (const row of packages) {
      const aggregate = ensure(row.destinationRoomId);
      if (row.status === PackageStatus.DELIVERED_TO_ROOM) {
        aggregate.arrivedPackageCount += row._count._all;
      } else if (INCOMING_PACKAGE_STATUSES.includes(row.status as PackageStatus)) {
        aggregate.incomingPackageCount += row._count._all;
      }
    }

    return result;
  }
}

interface RoomAggregate {
  bulkUnits: number;
  assetCount: number;
  activeTaskCount: number;
  incomingPackageCount: number;
  arrivedPackageCount: number;
}

function emptyAggregate(): RoomAggregate {
  return {
    bulkUnits: 0,
    assetCount: 0,
    activeTaskCount: 0,
    incomingPackageCount: 0,
    arrivedPackageCount: 0,
  };
}

/** מצב החדר לצביעה במפה. מוצג תמיד גם כטקסט במקרא (§10.7). */
export function computeRoomState(stats: RoomAggregate): RoomMapState {
  if (stats.arrivedPackageCount > 0) return RoomMapState.ARRIVED;
  if (stats.incomingPackageCount > 0) return RoomMapState.IN_TRANSIT;
  if (stats.activeTaskCount > 0) return RoomMapState.PACKING_IN_PROGRESS;
  if (stats.bulkUnits + stats.assetCount > 0) return RoomMapState.HAS_EQUIPMENT;
  return RoomMapState.EMPTY;
}

function toFloorMapSummary(map: {
  id: string;
  baseId: string;
  building: string;
  floorNumber: number;
  displayName: string;
  canvasWidth: number;
  canvasHeight: number;
  version: number;
}): FloorMapSummaryDto {
  return {
    id: map.id,
    baseId: map.baseId,
    building: map.building,
    floorNumber: map.floorNumber,
    displayName: map.displayName,
    canvasWidth: map.canvasWidth,
    canvasHeight: map.canvasHeight,
    version: map.version,
  };
}
