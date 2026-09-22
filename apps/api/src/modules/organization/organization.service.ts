import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  AssetDto,
  BaseDto,
  HUB_BASE_CODE,
  MappingStatus,
  OrganizationalUnitDto,
  PaginatedResult,
  RoomDto,
  RoomInventoryDto,
  RoomInventoryLineDto,
  TeamDto,
  UserRole,
} from '@south/shared';
import { AppException } from '../../common/errors/app.exception';
import { PrismaService } from '../../common/prisma/prisma.service';
import { paginate, toSkipTake } from '../../common/utils/pagination.util';
import type { AuthenticatedUser } from '../auth/auth.types';

const roomInclude = {
  base: { select: { id: true, name: true } },
  team: { select: { id: true, name: true } },
} satisfies Prisma.RoomInclude;

type RoomWithRelations = Prisma.RoomGetPayload<{ include: typeof roomInclude }>;

@Injectable()
export class OrganizationService {
  constructor(private readonly prisma: PrismaService) {}

  /** מזהה בסיס היעד (קריית התקשוב). נשמר במטמון לכל מחזור חיים של המופע. */
  private hubBaseIdCache: string | null | undefined;

  async hubBaseId(): Promise<string | null> {
    if (this.hubBaseIdCache !== undefined) return this.hubBaseIdCache;
    const base = await this.prisma.base.findFirst({
      where: { OR: [{ isDestinationHub: true }, { code: HUB_BASE_CODE }] },
      select: { id: true },
    });
    this.hubBaseIdCache = base?.id ?? null;
    return this.hubBaseIdCache;
  }

  async listBases(filter: { isDestinationHub?: boolean }): Promise<BaseDto[]> {
    const bases = await this.prisma.base.findMany({
      where: { isDestinationHub: filter.isDestinationHub },
      orderBy: [{ isDestinationHub: 'desc' }, { name: 'asc' }],
    });
    return bases.map((base) => ({
      id: base.id,
      code: base.code,
      name: base.name,
      addressText: base.addressText,
      latitude: Number(base.latitude),
      longitude: Number(base.longitude),
      isDestinationHub: base.isDestinationHub,
    }));
  }

  async listUnits(baseId?: string): Promise<OrganizationalUnitDto[]> {
    const units = await this.prisma.organizationalUnit.findMany({
      where: { baseId },
      orderBy: [{ name: 'asc' }],
    });
    return units.map((unit) => ({
      id: unit.id,
      name: unit.name,
      code: unit.code,
      baseId: unit.baseId,
      parentId: unit.parentId,
      type: unit.type,
    }));
  }

  async listTeams(
    user: AuthenticatedUser,
    filter: { baseId?: string; unitId?: string; search?: string },
  ): Promise<TeamDto[]> {
    const where: Prisma.TeamWhereInput = {
      unitId: filter.unitId,
      unit: filter.baseId ? { baseId: filter.baseId } : undefined,
      name: filter.search ? { contains: filter.search, mode: 'insensitive' } : undefined,
    };

    // NoCyberHere: AUTHORIZATION
    // Threat: ראש צוות שמנסה לראות צוותים שאינם בתחום ההרשאה שלו
    // Reason: צמצום התוצאה בשרת לפי תחום ההרשאה, ולא בצד הלקוח.
    if (user.role === UserRole.TEAM_LEAD) {
      where.id = { in: user.teamIds.length ? user.teamIds : ['00000000-0000-0000-0000-000000000000'] };
    }

    const teams = await this.prisma.team.findMany({
      where,
      include: {
        unit: { select: { id: true, name: true, baseId: true } },
        lead: { select: { id: true, fullName: true } },
      },
      orderBy: { name: 'asc' },
    });

    return teams.map((team) => ({
      id: team.id,
      name: team.name,
      code: team.code,
      unitId: team.unitId,
      unitName: team.unit.name,
      baseId: team.unit.baseId,
      leadUserId: team.leadUserId,
      leadUserName: team.lead?.fullName ?? null,
    }));
  }

  async listRooms(query: {
    page: number;
    pageSize: number;
    baseId?: string;
    unitId?: string;
    teamId?: string;
    building?: string;
    floor?: string;
    mappingStatus?: MappingStatus;
    search?: string;
  }): Promise<PaginatedResult<RoomDto>> {
    const where: Prisma.RoomWhereInput = {
      baseId: query.baseId,
      unitId: query.unitId,
      teamId: query.teamId,
      building: query.building,
      floor: query.floor,
      mappingStatus: query.mappingStatus,
      isActive: true,
      OR: query.search
        ? [
            { displayName: { contains: query.search, mode: 'insensitive' } },
            { roomNumber: { contains: query.search, mode: 'insensitive' } },
          ]
        : undefined,
    };

    const [total, rooms] = await this.prisma.$transaction([
      this.prisma.room.count({ where }),
      this.prisma.room.findMany({
        where,
        include: roomInclude,
        orderBy: [{ building: 'asc' }, { floor: 'asc' }, { roomNumber: 'asc' }],
        ...toSkipTake(query),
      }),
    ]);

    return paginate(rooms.map(toRoomDto), total, query);
  }

  async getRoom(roomId: string): Promise<RoomDto> {
    const room = await this.prisma.room.findUnique({ where: { id: roomId }, include: roomInclude });
    if (!room) throw new AppException('ROOM_NOT_FOUND');
    return toRoomDto(room);
  }

  /** מלאי מלא של חדר: ציוד כמותי לפי מק״ט + מחשבים ומסכים לפי ID ובעלים. */
  async roomInventory(roomId: string): Promise<RoomInventoryDto> {
    const room = await this.prisma.room.findUnique({ where: { id: roomId }, include: roomInclude });
    if (!room) throw new AppException('ROOM_NOT_FOUND');

    const [inventory, assets] = await Promise.all([
      this.prisma.roomInventory.findMany({
        where: { roomId },
        include: { product: true },
        orderBy: { product: { name: 'asc' } },
      }),
      this.prisma.assetInstance.findMany({
        where: { currentRoomId: roomId },
        include: { product: true, currentRoom: { select: { displayName: true } } },
        orderBy: [{ product: { name: 'asc' } }, { assetTag: 'asc' }],
      }),
    ]);

    const bulkLines: RoomInventoryLineDto[] = inventory.map((line) => ({
      productCatalogItemId: line.productCatalogItemId,
      sku: line.product.sku,
      productName: line.product.name,
      category: line.product.category,
      unitOfMeasure: line.product.unitOfMeasure,
      mappedQuantity: line.mappedQuantity,
      reservedQuantity: line.reservedQuantity,
      packedQuantity: line.packedQuantity,
      deliveredQuantity: line.deliveredQuantity,
      availableQuantity: Math.max(
        0,
        line.mappedQuantity - line.reservedQuantity - line.packedQuantity,
      ),
    }));

    const assetDtos: AssetDto[] = assets.map(toAssetDto);
    const bulkUnits = bulkLines.reduce((sum, line) => sum + line.mappedQuantity, 0);

    return {
      room: toRoomDto(room),
      bulkLines,
      assets: assetDtos,
      totals: {
        bulkUnits,
        assetUnits: assetDtos.length,
        totalUnits: bulkUnits + assetDtos.length,
      },
    };
  }
}

export function toRoomDto(room: RoomWithRelations): RoomDto {
  return {
    id: room.id,
    baseId: room.baseId,
    baseName: room.base.name,
    unitId: room.unitId,
    teamId: room.teamId,
    teamName: room.team?.name ?? null,
    building: room.building,
    floor: room.floor,
    roomNumber: room.roomNumber,
    displayName: room.displayName,
    floorMapId: room.floorMapId,
    mappingStatus: room.mappingStatus as MappingStatus,
    isActive: room.isActive,
  };
}

export function toAssetDto(asset: {
  id: string;
  assetTag: string;
  productCatalogItemId?: string;
  ownerName: string;
  ownerIdentityNumber: string | null;
  currentRoomId: string | null;
  status: string;
  reservedForTaskId: string | null;
  product: { sku: string; name: string; category: string };
  currentRoom?: { displayName: string } | null;
}): AssetDto {
  return {
    id: asset.id,
    assetTag: asset.assetTag,
    productCatalogItemId: asset.productCatalogItemId ?? '',
    productName: asset.product.name,
    sku: asset.product.sku,
    category: asset.product.category,
    ownerName: asset.ownerName,
    ownerIdentityNumber: asset.ownerIdentityNumber,
    currentRoomId: asset.currentRoomId,
    currentRoomName: asset.currentRoom?.displayName ?? null,
    status: asset.status as AssetDto['status'],
    reservedForTaskId: asset.reservedForTaskId,
  };
}
