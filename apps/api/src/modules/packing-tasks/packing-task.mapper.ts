import { Prisma } from '@prisma/client';
import {
  PackingTaskDto,
  PackingTaskLineDto,
  PackingTaskProgressDto,
  PackingTaskStatus,
  PackingTaskSummaryDto,
  TaskPriority,
  TrackingMode,
} from '@south/shared';
import { packageSummaryInclude, toPackageSummary } from '../packages/package.mapper';

export const taskSummaryInclude = {
  sourceRoom: { select: { displayName: true, base: { select: { name: true } } } },
  destinationRoom: {
    select: { displayName: true, building: true, floor: true, roomNumber: true },
  },
  team: { select: { name: true } },
  assignedSoldier: { select: { fullName: true } },
  lines: { select: { requestedQuantity: true, packedQuantity: true } },
  _count: { select: { packages: true } },
} satisfies Prisma.PackingTaskInclude;

export type TaskSummaryRow = Prisma.PackingTaskGetPayload<{ include: typeof taskSummaryInclude }>;

export const taskDetailInclude = {
  sourceRoom: {
    select: { id: true, displayName: true, baseId: true, base: { select: { name: true } } },
  },
  destinationRoom: {
    select: { id: true, displayName: true, building: true, floor: true, roomNumber: true },
  },
  team: { select: { id: true, name: true } },
  assignedSoldier: { select: { id: true, fullName: true } },
  createdBy: { select: { id: true, fullName: true } },
  lines: {
    include: {
      product: { select: { sku: true, name: true, trackingMode: true } },
      assetInstance: { select: { assetTag: true, ownerName: true } },
    },
  },
  packages: { include: packageSummaryInclude },
  _count: { select: { packages: true } },
} satisfies Prisma.PackingTaskInclude;

export type TaskDetailRow = Prisma.PackingTaskGetPayload<{ include: typeof taskDetailInclude }>;

export function computeProgress(
  lines: Array<{ requestedQuantity: number; packedQuantity: number }>,
  packageCount: number,
): PackingTaskProgressDto {
  const totalUnits = lines.reduce((sum, line) => sum + line.requestedQuantity, 0);
  const packedUnits = lines.reduce((sum, line) => sum + line.packedQuantity, 0);
  return {
    totalUnits,
    packedUnits,
    percent: totalUnits === 0 ? 0 : Math.round((packedUnits / totalUnits) * 100),
    packageCount,
  };
}

export function toTaskSummary(row: TaskSummaryRow): PackingTaskSummaryDto {
  return {
    id: row.id,
    taskNumber: row.taskNumber,
    status: row.status as PackingTaskStatus,
    priority: row.priority as TaskPriority,
    sourceRoomName: row.sourceRoom.displayName,
    sourceBaseName: row.sourceRoom.base.name,
    destinationRoomName: row.destinationRoom.displayName,
    teamName: row.team.name,
    assignedSoldierName: row.assignedSoldier.fullName,
    dueAt: row.dueAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    progress: computeProgress(row.lines, row._count.packages),
  };
}

export function toTaskDetail(row: TaskDetailRow): PackingTaskDto {
  const lines: PackingTaskLineDto[] = row.lines.map((line) => ({
    id: line.id,
    productCatalogItemId: line.productCatalogItemId,
    sku: line.product.sku,
    productName: line.product.name,
    trackingMode: line.product.trackingMode as TrackingMode,
    assetInstanceId: line.assetInstanceId,
    assetTag: line.assetInstance?.assetTag ?? null,
    ownerName: line.assetInstance?.ownerName ?? null,
    requestedQuantity: line.requestedQuantity,
    packedQuantity: line.packedQuantity,
    remainingQuantity: Math.max(0, line.requestedQuantity - line.packedQuantity),
  }));

  return {
    id: row.id,
    taskNumber: row.taskNumber,
    status: row.status as PackingTaskStatus,
    priority: row.priority as TaskPriority,
    sourceRoomId: row.sourceRoomId,
    sourceRoomName: row.sourceRoom.displayName,
    sourceBaseId: row.sourceRoom.baseId,
    sourceBaseName: row.sourceRoom.base.name,
    destinationRoomId: row.destinationRoomId,
    destinationRoomName: row.destinationRoom.displayName,
    destinationRoomDetails: {
      building: row.destinationRoom.building,
      floor: row.destinationRoom.floor,
      roomNumber: row.destinationRoom.roomNumber,
    },
    teamId: row.teamId,
    teamName: row.team.name,
    assignedSoldierId: row.assignedSoldierId,
    assignedSoldierName: row.assignedSoldier.fullName,
    createdById: row.createdById,
    createdByName: row.createdBy.fullName,
    notes: row.notes,
    dueAt: row.dueAt?.toISOString() ?? null,
    startedAt: row.startedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    progress: computeProgress(row.lines, row._count.packages),
    lines,
    packages: row.packages.map(toPackageSummary),
  };
}
