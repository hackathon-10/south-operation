import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  AssetDto,
  AssetStatus,
  CatalogItemDto,
  PaginatedResult,
  TrackingMode,
} from '@south/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { paginate, toSkipTake } from '../../common/utils/pagination.util';
import { toAssetDto } from '../organization/organization.service';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async listItems(query: {
    page: number;
    pageSize: number;
    search?: string;
    category?: string;
    trackingMode?: TrackingMode;
  }): Promise<PaginatedResult<CatalogItemDto>> {
    const where: Prisma.ProductCatalogItemWhereInput = {
      isActive: true,
      category: query.category,
      trackingMode: query.trackingMode,
      OR: query.search
        ? [
            { name: { contains: query.search, mode: 'insensitive' } },
            { sku: { contains: query.search, mode: 'insensitive' } },
          ]
        : undefined,
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.productCatalogItem.count({ where }),
      this.prisma.productCatalogItem.findMany({
        where,
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
        ...toSkipTake(query),
      }),
    ]);

    return paginate(
      rows.map((item) => ({
        id: item.id,
        sku: item.sku,
        name: item.name,
        category: item.category,
        trackingMode: item.trackingMode as TrackingMode,
        unitOfMeasure: item.unitOfMeasure,
        isActive: item.isActive,
      })),
      total,
      query,
    );
  }

  /**
   * רשימת מחשבים ומסכים. החיפוש הוא לפי המזהה שעל המדבקה או לפי שם הבעלים,
   * כדי שאיש השטח יוכל לאתר פריט בשדה אחד (§8.3.4).
   */
  async listAssets(query: {
    page: number;
    pageSize: number;
    roomId?: string;
    search?: string;
    status?: AssetStatus;
    packingTaskId?: string;
  }): Promise<PaginatedResult<AssetDto>> {
    const where: Prisma.AssetInstanceWhereInput = {
      currentRoomId: query.roomId,
      status: query.status,
      reservedForTaskId: query.packingTaskId,
      OR: query.search
        ? [
            { assetTag: { contains: query.search, mode: 'insensitive' } },
            { ownerName: { contains: query.search, mode: 'insensitive' } },
          ]
        : undefined,
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.assetInstance.count({ where }),
      this.prisma.assetInstance.findMany({
        where,
        include: {
          product: { select: { sku: true, name: true, category: true } },
          currentRoom: { select: { displayName: true } },
        },
        orderBy: [{ assetTag: 'asc' }],
        ...toSkipTake(query),
      }),
    ]);

    return paginate(rows.map(toAssetDto), total, query);
  }
}
