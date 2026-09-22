import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  AddPackageAssetInput,
  AddPackageBulkLineInput,
  AssetStatus,
  AuditAction,
  CreatePackageInput,
  PackageDto,
  PackageLabelDto,
  PackageScanResultDto,
  PackageStatus,
  PackageSummaryDto,
  PackagesQuery,
  PaginatedResult,
  PackingTaskStatus,
  ScanActionInput,
  UpdatePackageInput,
  UserRole,
  buildScanUrl,
  canTransitionPackage,
  isMissionBeforeDeparture,
} from '@south/shared';
import { APP_CONFIG, AppConfig } from '../../common/config/env.config';
import {
  PackageScope,
  assertEditPackageContent,
  assertViewPackage,
  canEditPackageContent,
  canHandleAtHub,
  isCommander,
} from '../../common/authz/access-control';
import { AppException } from '../../common/errors/app.exception';
import { PrismaService } from '../../common/prisma/prisma.service';
import { generatePublicToken, nextPackageNumber } from '../../common/utils/ids.util';
import { paginate, toSkipTake } from '../../common/utils/pagination.util';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { InventoryService } from '../inventory/inventory.service';
import { OrganizationService } from '../organization/organization.service';
import { PackingTasksService } from '../packing-tasks/packing-tasks.service';
import {
  PackageDetailRow,
  packageDetailInclude,
  packageSummaryInclude,
  toPackageDetail,
  toPackageSummary,
} from './package.mapper';

const NO_MATCH_ID = '00000000-0000-0000-0000-000000000000';

@Injectable()
export class PackagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly tasks: PackingTasksService,
    private readonly organization: OrganizationService,
    private readonly audit: AuditService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  // ============================================================
  // קריאה
  // ============================================================

  async list(
    user: AuthenticatedUser,
    query: PackagesQuery,
  ): Promise<PaginatedResult<PackageSummaryDto>> {
    const where: Prisma.PackageWhereInput = {
      status: query.status,
      teamId: query.teamId,
      sourceRoomId: query.sourceRoomId,
      destinationRoomId: query.destinationRoomId,
      packingTaskId: query.packingTaskId,
      sourceRoom: query.baseId ? { baseId: query.baseId } : undefined,
      missionPackage: query.missionId
        ? { transportMissionId: query.missionId }
        : query.availableForMission
          ? { is: null }
          : undefined,
    };

    if (query.availableForMission) {
      where.status = PackageStatus.READY_FOR_SHIPMENT;
    }

    if (query.search) {
      where.OR = [
        { packageNumber: { contains: query.search, mode: 'insensitive' } },
        { assets: { some: { assetTagSnapshot: { contains: query.search, mode: 'insensitive' } } } },
        { assets: { some: { ownerNameSnapshot: { contains: query.search, mode: 'insensitive' } } } },
      ];
    }

    // NoCyberHere: AUTHORIZATION
    // Threat: דליפת אריזות של צוותים או בסיסים אחרים דרך רשימות
    // Reason: תחום ההרשאה נאכף בשאילתה עצמה לפי תפקיד המשתמש.
    const hubBaseId = await this.organization.hubBaseId();
    if (user.role === UserRole.TEAM_LEAD) {
      where.teamId = { in: user.teamIds.length ? user.teamIds : [NO_MATCH_ID] };
    } else if (user.role === UserRole.LOGISTICS_SOLDIER) {
      where.AND = [
        {
          OR: [
            { task: { assignedSoldierId: user.id } },
            { missionPackage: { mission: { assignedSoldierId: user.id } } },
            ...(user.baseId ? [{ sourceRoom: { baseId: user.baseId } }] : []),
            ...(hubBaseId && user.baseId === hubBaseId
              ? [{ destinationRoom: { baseId: hubBaseId } }]
              : []),
          ],
        },
      ];
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.package.count({ where }),
      this.prisma.package.findMany({
        where,
        include: packageSummaryInclude,
        orderBy: [{ createdAt: 'desc' }],
        ...toSkipTake(query),
      }),
    ]);

    return paginate(rows.map(toPackageSummary), total, query);
  }

  async get(user: AuthenticatedUser, packageId: string): Promise<PackageDto> {
    const row = await this.loadPackage(packageId);
    return this.toAuthorizedDetail(user, row);
  }

  /** סריקת QR: מחזירה את האריזה ואת הפעולה המומלצת לפי הסטטוס והתפקיד (§8.4). */
  async scanByToken(
    user: AuthenticatedUser,
    publicToken: string,
  ): Promise<PackageScanResultDto> {
    const row = await this.prisma.package.findUnique({
      where: { publicToken },
      include: packageDetailInclude,
    });
    if (!row) throw new AppException('PACKAGE_TOKEN_NOT_FOUND');

    const detail = await this.toAuthorizedDetail(user, row);

    await this.audit.record({
      actorUserId: user.id,
      action: AuditAction.PACKAGE_SCANNED,
      entityType: 'Package',
      entityId: row.id,
      metadata: { status: row.status, role: user.role },
    });

    const { action, label } = this.suggestedAction(user, detail);
    return {
      package: detail,
      suggestedAction: action,
      suggestedActionLabel: label,
      missionId: detail.missionId,
    };
  }

  async label(user: AuthenticatedUser, packageId: string): Promise<PackageLabelDto> {
    const row = await this.loadPackage(packageId);
    const detail = await this.toAuthorizedDetail(user, row);

    await this.audit.record({
      actorUserId: user.id,
      action: AuditAction.PACKAGE_LABEL_PRINTED,
      entityType: 'Package',
      entityId: row.id,
    });

    return {
      packageNumber: row.packageNumber,
      // ה-QR מכיל URL עם Token אקראי בלבד: אין בו שם, בעלים, יחידה, חדר או מק״ט.
      qrUrl: buildScanUrl(this.config.PUBLIC_WEB_URL, row.publicToken),
      sourceBaseName: row.sourceRoom.base.name,
      sourceRoomName: row.sourceRoom.displayName,
      teamName: row.team.name,
      destination: {
        building: row.destinationRoom.building,
        floor: row.destinationRoom.floor,
        roomNumber: row.destinationRoom.roomNumber,
        displayName: row.destinationRoom.displayName,
      },
      lineCount: detail.itemLineCount,
      totalUnits: detail.totalUnits,
      sealedAt: row.sealedAt?.toISOString() ?? null,
      printedAt: new Date().toISOString(),
    };
  }

  // ============================================================
  // יצירה ועריכה
  // ============================================================

  async createFromTask(
    user: AuthenticatedUser,
    taskId: string,
    input: CreatePackageInput,
  ): Promise<PackageDto> {
    const task = await this.prisma.packingTask.findUnique({
      where: { id: taskId },
      include: { sourceRoom: { select: { baseId: true } } },
    });
    if (!task) throw new AppException('TASK_NOT_FOUND');

    if (!isCommander(user) && task.assignedSoldierId !== user.id) {
      throw new AppException('FORBIDDEN_TASK_SCOPE');
    }
    if (
      task.status !== PackingTaskStatus.ASSIGNED &&
      task.status !== PackingTaskStatus.IN_PROGRESS
    ) {
      throw new AppException('TASK_INVALID_STATUS');
    }

    const packageId = await this.prisma.$transaction(async (tx) => {
      await this.tasks.markInProgress(tx, taskId, user.id);

      const created = await tx.package.create({
        data: {
          packageNumber: await nextPackageNumber(tx),
          publicToken: generatePublicToken(),
          packingTaskId: taskId,
          sourceRoomId: task.sourceRoomId,
          destinationRoomId: task.destinationRoomId,
          teamId: task.teamId,
          packageType: input.packageType,
          notes: input.notes ?? null,
          status: PackageStatus.OPEN,
          createdById: user.id,
        },
      });

      await tx.packageStatusEvent.create({
        data: {
          packageId: created.id,
          fromStatus: null,
          toStatus: PackageStatus.OPEN,
          actorUserId: user.id,
          note: 'אריזה נפתחה',
        },
      });

      await this.audit.record(
        {
          actorUserId: user.id,
          action: AuditAction.PACKAGE_CREATED,
          entityType: 'Package',
          entityId: created.id,
          after: { packageNumber: created.packageNumber, taskId, packageType: input.packageType },
        },
        tx,
      );

      return created.id;
    });

    return this.get(user, packageId);
  }

  async update(
    user: AuthenticatedUser,
    packageId: string,
    input: UpdatePackageInput,
  ): Promise<PackageDto> {
    const row = await this.loadPackage(packageId);
    this.assertEditable(user, row);

    await this.prisma.$transaction(async (tx) => {
      await tx.package.update({
        where: { id: packageId },
        data: {
          packageType: input.packageType,
          notes: input.notes === null ? null : input.notes,
        },
      });
      await this.audit.record(
        {
          actorUserId: user.id,
          action: AuditAction.PACKAGE_UPDATED,
          entityType: 'Package',
          entityId: packageId,
          before: { packageType: row.packageType, notes: row.notes },
          after: input,
        },
        tx,
      );
    });

    return this.get(user, packageId);
  }

  /** הוספת מחשב או מסך לאריזה, לפי מזהה פנימי או לפי המזהה שעל המדבקה. */
  async addAsset(
    user: AuthenticatedUser,
    packageId: string,
    input: AddPackageAssetInput,
  ): Promise<PackageDto> {
    const row = await this.loadPackage(packageId);
    this.assertEditable(user, row);

    const asset = await this.prisma.assetInstance.findFirst({
      where: input.assetInstanceId
        ? { id: input.assetInstanceId }
        : { assetTag: input.assetTag!.trim() },
      include: { product: { select: { name: true } } },
    });
    if (!asset) throw new AppException('ASSET_NOT_FOUND');

    const line = await this.prisma.packingTaskLine.findFirst({
      where: { packingTaskId: row.packingTaskId, assetInstanceId: asset.id },
    });
    if (!line) throw new AppException('ASSET_NOT_IN_TASK');
    if (line.packedQuantity >= line.requestedQuantity) {
      throw new AppException('ASSET_ALREADY_PACKED');
    }

    await this.prisma.$transaction(async (tx) => {
      await this.inventory.markAssetPacked(tx, asset.id, row.packingTaskId);

      await tx.packageAsset.create({
        data: {
          packageId,
          assetInstanceId: asset.id,
          assetTagSnapshot: asset.assetTag,
          productNameSnapshot: asset.product.name,
          ownerNameSnapshot: asset.ownerName,
        },
      });

      await tx.packingTaskLine.update({
        where: { id: line.id },
        data: { packedQuantity: { increment: 1 } },
      });

      await this.audit.record(
        {
          actorUserId: user.id,
          action: AuditAction.PACKAGE_CONTENT_ADDED,
          entityType: 'Package',
          entityId: packageId,
          after: { assetTag: asset.assetTag, kind: 'ASSET' },
        },
        tx,
      );
    });

    return this.get(user, packageId);
  }

  async removeAsset(
    user: AuthenticatedUser,
    packageId: string,
    assetInstanceId: string,
  ): Promise<PackageDto> {
    const row = await this.loadPackage(packageId);
    this.assertEditable(user, row);

    const packageAsset = await this.prisma.packageAsset.findFirst({
      where: { packageId, assetInstanceId },
    });
    if (!packageAsset) throw new AppException('PACKAGE_LINE_NOT_FOUND');

    await this.prisma.$transaction(async (tx) => {
      await tx.packageAsset.delete({ where: { id: packageAsset.id } });
      await this.inventory.markAssetBackToReserved(tx, assetInstanceId);

      const line = await tx.packingTaskLine.findFirst({
        where: { packingTaskId: row.packingTaskId, assetInstanceId },
      });
      if (line && line.packedQuantity > 0) {
        await tx.packingTaskLine.update({
          where: { id: line.id },
          data: { packedQuantity: { decrement: 1 } },
        });
      }

      await this.audit.record(
        {
          actorUserId: user.id,
          action: AuditAction.PACKAGE_CONTENT_REMOVED,
          entityType: 'Package',
          entityId: packageId,
          before: { assetTag: packageAsset.assetTagSnapshot, kind: 'ASSET' },
        },
        tx,
      );
    });

    return this.get(user, packageId);
  }

  /** הוספת ציוד כמותי לאריזה, עד הכמות שנותרה במשימה. */
  async addBulkLine(
    user: AuthenticatedUser,
    packageId: string,
    input: AddPackageBulkLineInput,
  ): Promise<PackageDto> {
    const row = await this.loadPackage(packageId);
    this.assertEditable(user, row);

    const taskLine = await this.prisma.packingTaskLine.findFirst({
      where: {
        packingTaskId: row.packingTaskId,
        productCatalogItemId: input.productCatalogItemId,
        assetInstanceId: null,
      },
    });
    if (!taskLine) throw new AppException('PRODUCT_NOT_IN_TASK');

    const remaining = taskLine.requestedQuantity - taskLine.packedQuantity;
    if (input.quantity > remaining) throw new AppException('QUANTITY_EXCEEDS_TASK');

    await this.prisma.$transaction(async (tx) => {
      await this.inventory.moveReservedToPacked(
        tx,
        row.sourceRoomId,
        input.productCatalogItemId,
        input.quantity,
      );

      await tx.packageBulkLine.upsert({
        where: {
          packageId_productCatalogItemId: {
            packageId,
            productCatalogItemId: input.productCatalogItemId,
          },
        },
        create: {
          packageId,
          productCatalogItemId: input.productCatalogItemId,
          quantity: input.quantity,
        },
        update: { quantity: { increment: input.quantity } },
      });

      await tx.packingTaskLine.update({
        where: { id: taskLine.id },
        data: { packedQuantity: { increment: input.quantity } },
      });

      await this.audit.record(
        {
          actorUserId: user.id,
          action: AuditAction.PACKAGE_CONTENT_ADDED,
          entityType: 'Package',
          entityId: packageId,
          after: { productCatalogItemId: input.productCatalogItemId, quantity: input.quantity },
        },
        tx,
      );
    });

    return this.get(user, packageId);
  }

  async updateBulkLine(
    user: AuthenticatedUser,
    packageId: string,
    lineId: string,
    quantity: number,
  ): Promise<PackageDto> {
    const row = await this.loadPackage(packageId);
    this.assertEditable(user, row);

    const bulkLine = await this.prisma.packageBulkLine.findFirst({
      where: { id: lineId, packageId },
    });
    if (!bulkLine) throw new AppException('PACKAGE_LINE_NOT_FOUND');

    const taskLine = await this.prisma.packingTaskLine.findFirst({
      where: {
        packingTaskId: row.packingTaskId,
        productCatalogItemId: bulkLine.productCatalogItemId,
        assetInstanceId: null,
      },
    });
    if (!taskLine) throw new AppException('PRODUCT_NOT_IN_TASK');

    const delta = quantity - bulkLine.quantity;
    if (delta === 0) return this.get(user, packageId);

    if (delta > 0) {
      const remaining = taskLine.requestedQuantity - taskLine.packedQuantity;
      if (delta > remaining) throw new AppException('QUANTITY_EXCEEDS_TASK');
    }

    await this.prisma.$transaction(async (tx) => {
      if (delta > 0) {
        await this.inventory.moveReservedToPacked(
          tx,
          row.sourceRoomId,
          bulkLine.productCatalogItemId,
          delta,
        );
      } else {
        await this.inventory.movePackedToReserved(
          tx,
          row.sourceRoomId,
          bulkLine.productCatalogItemId,
          -delta,
        );
      }

      await tx.packageBulkLine.update({ where: { id: lineId }, data: { quantity } });
      await tx.packingTaskLine.update({
        where: { id: taskLine.id },
        data: { packedQuantity: { increment: delta } },
      });

      await this.audit.record(
        {
          actorUserId: user.id,
          action: AuditAction.PACKAGE_CONTENT_UPDATED,
          entityType: 'Package',
          entityId: packageId,
          before: { quantity: bulkLine.quantity },
          after: { quantity },
        },
        tx,
      );
    });

    return this.get(user, packageId);
  }

  async removeBulkLine(
    user: AuthenticatedUser,
    packageId: string,
    lineId: string,
  ): Promise<PackageDto> {
    const row = await this.loadPackage(packageId);
    this.assertEditable(user, row);

    const bulkLine = await this.prisma.packageBulkLine.findFirst({
      where: { id: lineId, packageId },
    });
    if (!bulkLine) throw new AppException('PACKAGE_LINE_NOT_FOUND');

    await this.prisma.$transaction(async (tx) => {
      await this.inventory.movePackedToReserved(
        tx,
        row.sourceRoomId,
        bulkLine.productCatalogItemId,
        bulkLine.quantity,
      );

      await tx.packageBulkLine.delete({ where: { id: lineId } });

      const taskLine = await tx.packingTaskLine.findFirst({
        where: {
          packingTaskId: row.packingTaskId,
          productCatalogItemId: bulkLine.productCatalogItemId,
          assetInstanceId: null,
        },
      });
      if (taskLine) {
        await tx.packingTaskLine.update({
          where: { id: taskLine.id },
          data: { packedQuantity: { decrement: bulkLine.quantity } },
        });
      }

      await this.audit.record(
        {
          actorUserId: user.id,
          action: AuditAction.PACKAGE_CONTENT_REMOVED,
          entityType: 'Package',
          entityId: packageId,
          before: {
            productCatalogItemId: bulkLine.productCatalogItemId,
            quantity: bulkLine.quantity,
          },
        },
        tx,
      );
    });

    return this.get(user, packageId);
  }

  // ============================================================
  // מעברי סטטוס
  // ============================================================

  /**
   * סגירת אריזה: OPEN -> SEALED -> READY_FOR_SHIPMENT באותו Use Case,
   * עם שני אירועים נפרדים בציר הזמן (§8.12).
   */
  async seal(user: AuthenticatedUser, packageId: string): Promise<PackageDto> {
    const row = await this.loadPackage(packageId);
    this.assertEditable(user, row);

    const isEmpty = row.assets.length === 0 && row.bulkLines.length === 0;
    if (isEmpty) throw new AppException('EMPTY_PACKAGE');

    await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      await tx.package.update({
        where: { id: packageId },
        data: { status: PackageStatus.SEALED, sealedAt: now },
      });
      await tx.packageStatusEvent.create({
        data: {
          packageId,
          fromStatus: PackageStatus.OPEN,
          toStatus: PackageStatus.SEALED,
          actorUserId: user.id,
          note: 'החייל סיים להזין תכולה',
        },
      });

      // Validation שרת עבר בהצלחה -> האריזה מוכנה לשילוח.
      await tx.package.update({
        where: { id: packageId },
        data: { status: PackageStatus.READY_FOR_SHIPMENT },
      });
      await tx.packageStatusEvent.create({
        data: {
          packageId,
          fromStatus: PackageStatus.SEALED,
          toStatus: PackageStatus.READY_FOR_SHIPMENT,
          actorUserId: user.id,
          note: 'בדיקת תקינות עברה בהצלחה',
        },
      });

      await this.audit.record(
        {
          actorUserId: user.id,
          action: AuditAction.PACKAGE_SEALED,
          entityType: 'Package',
          entityId: packageId,
          after: { assets: row.assets.length, bulkLines: row.bulkLines.length },
        },
        tx,
      );

      await this.tasks.completeIfFullyPacked(tx, row.packingTaskId, user.id);
    });

    return this.get(user, packageId);
  }

  /** פתיחה מחדש - מותרת כל עוד השליחות לא יצאה לדרך (§8.5). */
  async reopen(user: AuthenticatedUser, packageId: string, reason?: string): Promise<PackageDto> {
    const row = await this.loadPackage(packageId);
    const scope = this.scopeOf(row);

    if (!canEditPackageContent(user, scope)) {
      throw new AppException('FORBIDDEN_PACKAGE_SCOPE');
    }

    const status = row.status as PackageStatus;
    if (status === PackageStatus.OPEN) return this.get(user, packageId);

    if (!canTransitionPackage(status, PackageStatus.OPEN)) {
      // אריזה שיצאה לדרך נעולה.
      throw new AppException('PACKAGE_LOCKED');
    }

    if (row.missionPackage) {
      const missionStatus = row.missionPackage.mission.status;
      if (!isMissionBeforeDeparture(missionStatus as never)) {
        throw new AppException('PACKAGE_LOCKED');
      }
    }

    await this.prisma.$transaction(async (tx) => {
      if (row.missionPackage) {
        // הסרה משליחות שטרם יצאה, לפני החזרה ל-OPEN.
        await tx.missionPackage.deleteMany({ where: { packageId } });
      }

      await tx.package.update({
        where: { id: packageId },
        data: { status: PackageStatus.OPEN, sealedAt: null },
      });
      await tx.packageStatusEvent.create({
        data: {
          packageId,
          fromStatus: status,
          toStatus: PackageStatus.OPEN,
          actorUserId: user.id,
          note: reason ?? 'האריזה נפתחה מחדש',
        },
      });
      await this.audit.record(
        {
          actorUserId: user.id,
          action: AuditAction.PACKAGE_REOPENED,
          entityType: 'Package',
          entityId: packageId,
          before: { status },
          metadata: { reason: reason ?? null },
        },
        tx,
      );

      // המשימה חוזרת לביצוע אם הייתה כבר מסומנת כהושלמה.
      await tx.packingTask.updateMany({
        where: { id: row.packingTaskId, status: PackingTaskStatus.COMPLETED },
        data: { status: PackingTaskStatus.IN_PROGRESS, completedAt: null },
      });
    });

    return this.get(user, packageId);
  }

  /** קליטה בקריית התקשוב (§8.9). */
  async receive(
    user: AuthenticatedUser,
    packageId: string,
    input: ScanActionInput = {},
  ): Promise<PackageDto> {
    const row = await this.loadPackage(packageId);
    const hubBaseId = await this.organization.hubBaseId();
    const scope = this.scopeOf(row);

    if (!canHandleAtHub(user, scope, hubBaseId)) {
      throw new AppException('FORBIDDEN_PACKAGE_SCOPE');
    }

    const status = row.status as PackageStatus;
    if (status === PackageStatus.RECEIVED_AT_HUB || status === PackageStatus.DELIVERED_TO_ROOM) {
      throw new AppException('PACKAGE_ALREADY_RECEIVED');
    }
    if (!canTransitionPackage(status, PackageStatus.RECEIVED_AT_HUB)) {
      throw new AppException('PACKAGE_INVALID_STATUS');
    }

    await this.prisma.$transaction(async (tx) => {
      const fresh = await this.ensureIdempotent(tx, 'package.receive', input.idempotencyKey, user.id, packageId);
      if (!fresh) return;

      const now = new Date();
      await tx.package.update({
        where: { id: packageId },
        data: { status: PackageStatus.RECEIVED_AT_HUB, receivedAt: now },
      });
      await tx.missionPackage.updateMany({
        where: { packageId, unloadedAt: null },
        data: { unloadedAt: now, unloadedById: user.id },
      });
      await this.inventory.setAssetsStatusForPackage(tx, packageId, AssetStatus.RECEIVED);
      await tx.packageStatusEvent.create({
        data: {
          packageId,
          fromStatus: status,
          toStatus: PackageStatus.RECEIVED_AT_HUB,
          actorUserId: user.id,
          missionId: row.missionPackage?.mission.id ?? null,
          note: input.note ?? 'התקבל בקריית התקשוב',
        },
      });
      await this.audit.record(
        {
          actorUserId: user.id,
          action: AuditAction.PACKAGE_RECEIVED,
          entityType: 'Package',
          entityId: packageId,
        },
        tx,
      );
    });

    return this.get(user, packageId);
  }

  /** פיזור לחדר היעד (§8.10). מעדכן גם את מיקום הפריטים ואת מלאי חדר היעד. */
  async deliver(
    user: AuthenticatedUser,
    packageId: string,
    input: ScanActionInput = {},
  ): Promise<PackageDto> {
    const row = await this.loadPackage(packageId);
    const hubBaseId = await this.organization.hubBaseId();
    const scope = this.scopeOf(row);

    if (!canHandleAtHub(user, scope, hubBaseId)) {
      throw new AppException('FORBIDDEN_PACKAGE_SCOPE');
    }

    const status = row.status as PackageStatus;
    if (status === PackageStatus.DELIVERED_TO_ROOM) {
      throw new AppException('PACKAGE_ALREADY_DELIVERED');
    }
    if (status !== PackageStatus.RECEIVED_AT_HUB) {
      throw new AppException('PACKAGE_NOT_RECEIVED');
    }

    await this.prisma.$transaction(async (tx) => {
      const fresh = await this.ensureIdempotent(tx, 'package.deliver', input.idempotencyKey, user.id, packageId);
      if (!fresh) return;

      const now = new Date();
      await tx.package.update({
        where: { id: packageId },
        data: { status: PackageStatus.DELIVERED_TO_ROOM, deliveredAt: now },
      });

      for (const line of row.bulkLines) {
        await this.inventory.deliverBulkToDestination(tx, {
          sourceRoomId: row.sourceRoomId,
          destinationRoomId: row.destinationRoomId,
          productCatalogItemId: line.productCatalogItemId,
          quantity: line.quantity,
        });
      }

      await this.inventory.setAssetsStatusForPackage(tx, packageId, AssetStatus.DELIVERED, {
        currentRoomId: row.destinationRoomId,
      });

      await tx.packageStatusEvent.create({
        data: {
          packageId,
          fromStatus: status,
          toStatus: PackageStatus.DELIVERED_TO_ROOM,
          actorUserId: user.id,
          missionId: row.missionPackage?.mission.id ?? null,
          note: input.note ?? 'הונח בחדר היעד',
        },
      });

      await this.audit.record(
        {
          actorUserId: user.id,
          action: AuditAction.PACKAGE_DELIVERED,
          entityType: 'Package',
          entityId: packageId,
          after: { destinationRoomId: row.destinationRoomId },
        },
        tx,
      );
    });

    return this.get(user, packageId);
  }

  // ============================================================
  // עזרים
  // ============================================================

  /**
   * NoCyberHere: INPUT_VALIDATION
   * Threat: פעולה כפולה בעקבות סריקה חוזרת או לחיצה כפולה
   * Reason: מפתח Idempotency ייחודי למשתמש ולפעולה. סריקה חוזרת לא תיצור פעולה נוספת.
   */
  private async ensureIdempotent(
    tx: Prisma.TransactionClient,
    scope: string,
    key: string | undefined,
    userId: string,
    entityId: string,
  ): Promise<boolean> {
    if (!key) return true;
    try {
      await tx.idempotencyRecord.create({ data: { scope, key, userId, entityId } });
      return true;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return false;
      }
      throw error;
    }
  }

  private async loadPackage(packageId: string): Promise<PackageDetailRow> {
    const row = await this.prisma.package.findUnique({
      where: { id: packageId },
      include: packageDetailInclude,
    });
    if (!row) throw new AppException('PACKAGE_NOT_FOUND');
    return row;
  }

  private scopeOf(row: PackageDetailRow): PackageScope {
    return {
      teamId: row.teamId,
      sourceBaseId: row.sourceRoom.baseId,
      destinationBaseId: row.destinationRoom.baseId,
      taskAssignedSoldierId: row.task.assignedSoldierId,
      missionAssignedSoldierId: row.missionPackage?.mission.assignedSoldierId ?? null,
    };
  }

  private async toAuthorizedDetail(
    user: AuthenticatedUser,
    row: PackageDetailRow,
  ): Promise<PackageDto> {
    const hubBaseId = await this.organization.hubBaseId();
    const scope = this.scopeOf(row);
    assertViewPackage(user, scope, hubBaseId);

    return toPackageDetail(row, {
      canEditContent: canEditPackageContent(user, scope),
      canHandleAtHub: canHandleAtHub(user, scope, hubBaseId),
      canPrintLabel: user.role !== UserRole.TEAM_LEAD,
    });
  }

  /** עריכת תכולה מותרת רק לאריזה פתוחה, ורק למי שהמשימה שויכה אליו. */
  private assertEditable(user: AuthenticatedUser, row: PackageDetailRow): void {
    const scope = this.scopeOf(row);
    assertEditPackageContent(user, scope);

    const status = row.status as PackageStatus;
    if (status !== PackageStatus.OPEN) {
      if (
        status === PackageStatus.IN_TRANSIT ||
        status === PackageStatus.RECEIVED_AT_HUB ||
        status === PackageStatus.DELIVERED_TO_ROOM
      ) {
        throw new AppException('PACKAGE_LOCKED');
      }
      throw new AppException('PACKAGE_INVALID_STATUS');
    }
  }

  private suggestedAction(
    user: AuthenticatedUser,
    detail: PackageDto,
  ): { action: PackageScanResultDto['suggestedAction']; label: string } {
    if (user.role === UserRole.TEAM_LEAD) {
      return { action: 'VIEW_ONLY', label: 'צפייה בפרטי האריזה' };
    }
    switch (detail.status) {
      case PackageStatus.OPEN:
        return detail.permissions.canEditContent
          ? { action: 'CONTINUE_PACKING', label: 'המשך אריזה' }
          : { action: 'VIEW_ONLY', label: 'צפייה בפרטי האריזה' };
      case PackageStatus.READY_FOR_SHIPMENT:
      case PackageStatus.ASSIGNED_TO_MISSION:
        return { action: 'LOAD', label: 'סימון העמסה' };
      case PackageStatus.IN_TRANSIT:
        return detail.permissions.canReceive
          ? { action: 'RECEIVE', label: 'קליטה בקריית התקשוב' }
          : { action: 'VIEW_ONLY', label: 'צפייה בפרטי האריזה' };
      case PackageStatus.RECEIVED_AT_HUB:
        return detail.permissions.canDeliver
          ? { action: 'DELIVER', label: 'פיזור לחדר היעד' }
          : { action: 'VIEW_ONLY', label: 'צפייה בפרטי האריזה' };
      case PackageStatus.DELIVERED_TO_ROOM:
        return { action: 'NOTHING_TO_DO', label: 'האריזה כבר הגיעה לחדר' };
      default:
        return { action: 'VIEW_ONLY', label: 'צפייה בפרטי האריזה' };
    }
  }
}
