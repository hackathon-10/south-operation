import { Prisma } from '@prisma/client';
import {
  PackageDto,
  PackageStatus,
  PackageSummaryDto,
  PackageType,
  TaskPriority,
  isPackageContentEditable,
  isPackageLocked,
} from '@south/shared';

/** סטטוסים שמהם ניתן לפתוח אריזה מחדש (כל עוד השליחות לא יצאה). */
const REOPENABLE_STATUSES: PackageStatus[] = [
  PackageStatus.SEALED,
  PackageStatus.READY_FOR_SHIPMENT,
  PackageStatus.ASSIGNED_TO_MISSION,
];

/** Include מינימלי לכרטיס אריזה ברשימות. */
export const packageSummaryInclude = {
  team: { select: { id: true, name: true } },
  task: { select: { id: true, taskNumber: true, priority: true, assignedSoldierId: true } },
  sourceRoom: {
    select: { id: true, displayName: true, baseId: true, base: { select: { name: true } } },
  },
  destinationRoom: {
    select: {
      id: true,
      displayName: true,
      building: true,
      floor: true,
      roomNumber: true,
      baseId: true,
    },
  },
  missionPackage: {
    select: {
      loadedAt: true,
      unloadedAt: true,
      mission: { select: { id: true, missionNumber: true, assignedSoldierId: true, status: true } },
    },
  },
  assets: { select: { id: true } },
  bulkLines: { select: { quantity: true } },
} satisfies Prisma.PackageInclude;

export type PackageSummaryRow = Prisma.PackageGetPayload<{ include: typeof packageSummaryInclude }>;

/** Include מלא למסך פרטי אריזה, כולל תכולה וציר זמן. */
export const packageDetailInclude = {
  ...packageSummaryInclude,
  createdBy: { select: { id: true, fullName: true } },
  assets: {
    select: {
      id: true,
      assetInstanceId: true,
      assetTagSnapshot: true,
      productNameSnapshot: true,
      ownerNameSnapshot: true,
      assetInstance: {
        select: {
          ownerIdentityNumber: true,
          product: { select: { sku: true, name: true } },
        },
      },
    },
  },
  bulkLines: {
    select: {
      id: true,
      quantity: true,
      productCatalogItemId: true,
      product: { select: { sku: true, name: true, unitOfMeasure: true } },
    },
  },
  statusEvents: {
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      fromStatus: true,
      toStatus: true,
      actorUserId: true,
      note: true,
      createdAt: true,
      actor: { select: { fullName: true } },
      mission: { select: { id: true, missionNumber: true } },
    },
  },
} satisfies Prisma.PackageInclude;

export type PackageDetailRow = Prisma.PackageGetPayload<{ include: typeof packageDetailInclude }>;

export function toPackageSummary(row: PackageSummaryRow): PackageSummaryDto {
  const totalUnits =
    row.assets.length + row.bulkLines.reduce((sum, line) => sum + line.quantity, 0);

  return {
    id: row.id,
    packageNumber: row.packageNumber,
    status: row.status as PackageStatus,
    packageType: row.packageType as PackageType,
    sourceBaseName: row.sourceRoom.base.name,
    sourceRoomName: row.sourceRoom.displayName,
    destinationRoomName: row.destinationRoom.displayName,
    destination: {
      building: row.destinationRoom.building,
      floor: row.destinationRoom.floor,
      roomNumber: row.destinationRoom.roomNumber,
    },
    teamId: row.teamId,
    teamName: row.team.name,
    itemLineCount: row.assets.length + row.bulkLines.length,
    totalUnits,
    missionId: row.missionPackage?.mission.id ?? null,
    missionNumber: row.missionPackage?.mission.missionNumber ?? null,
    sealedAt: row.sealedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    priority: row.task.priority as TaskPriority,
  };
}

export interface PackagePermissionContext {
  canEditContent: boolean;
  canHandleAtHub: boolean;
  canPrintLabel: boolean;
}

export function toPackageDetail(
  row: PackageDetailRow,
  permissions: PackagePermissionContext,
): PackageDto {
  const summary = toPackageSummary(row as unknown as PackageSummaryRow);
  const status = row.status as PackageStatus;
  const locked = isPackageLocked(status);
  const contentEditable = isPackageContentEditable(status) && permissions.canEditContent;

  return {
    ...summary,
    packingTaskId: row.packingTaskId,
    taskNumber: row.task.taskNumber,
    sourceBaseId: row.sourceRoom.baseId,
    sourceRoomId: row.sourceRoomId,
    destinationRoomId: row.destinationRoomId,
    notes: row.notes,
    createdById: row.createdById,
    createdByName: row.createdBy.fullName,
    departedAt: row.departedAt?.toISOString() ?? null,
    receivedAt: row.receivedAt?.toISOString() ?? null,
    deliveredAt: row.deliveredAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
    isLocked: locked,
    assets: row.assets.map((asset) => ({
      id: asset.id,
      assetInstanceId: asset.assetInstanceId,
      assetTag: asset.assetTagSnapshot,
      productName: asset.productNameSnapshot,
      sku: asset.assetInstance.product.sku,
      ownerName: asset.ownerNameSnapshot,
      ownerIdentityNumber: asset.assetInstance.ownerIdentityNumber,
    })),
    bulkLines: row.bulkLines.map((line) => ({
      id: line.id,
      productCatalogItemId: line.productCatalogItemId,
      sku: line.product.sku,
      productName: line.product.name,
      unitOfMeasure: line.product.unitOfMeasure,
      quantity: line.quantity,
    })),
    timeline: row.statusEvents.map((event) => ({
      id: event.id,
      fromStatus: (event.fromStatus as PackageStatus) ?? null,
      toStatus: event.toStatus as PackageStatus,
      actorUserId: event.actorUserId,
      actorName: event.actor.fullName,
      missionId: event.mission?.id ?? null,
      missionNumber: event.mission?.missionNumber ?? null,
      note: event.note,
      createdAt: event.createdAt.toISOString(),
    })),
    permissions: {
      canEditContent: contentEditable,
      canSeal: contentEditable && status === PackageStatus.OPEN,
      canReopen: permissions.canEditContent && !locked && REOPENABLE_STATUSES.includes(status),
      canReceive: permissions.canHandleAtHub && status === PackageStatus.IN_TRANSIT,
      canDeliver: permissions.canHandleAtHub && status === PackageStatus.RECEIVED_AT_HUB,
      canPrintLabel: permissions.canPrintLabel && status !== PackageStatus.OPEN,
    },
  };
}
