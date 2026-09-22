import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  AuditAction,
  CreatePackingTaskInput,
  PackingTaskDto,
  PackingTaskStatus,
  PackingTaskSummaryDto,
  PackingTasksQuery,
  PaginatedResult,
  TrackingMode,
  UpdatePackingTaskInput,
  UserRole,
  canTransitionTask,
} from '@south/shared';
import { assertExecuteTask, assertViewTask, isCommander } from '../../common/authz/access-control';
import { AppException } from '../../common/errors/app.exception';
import { PrismaService } from '../../common/prisma/prisma.service';
import { nextTaskNumber } from '../../common/utils/ids.util';
import { paginate, toSkipTake } from '../../common/utils/pagination.util';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { InventoryService } from '../inventory/inventory.service';
import {
  TaskDetailRow,
  taskDetailInclude,
  taskSummaryInclude,
  toTaskDetail,
  toTaskSummary,
} from './packing-task.mapper';

@Injectable()
export class PackingTasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly audit: AuditService,
  ) {}

  async list(
    user: AuthenticatedUser,
    query: PackingTasksQuery,
  ): Promise<PaginatedResult<PackingTaskSummaryDto>> {
    const where: Prisma.PackingTaskWhereInput = {
      status: query.status,
      priority: query.priority,
      teamId: query.teamId,
      sourceRoomId: query.sourceRoomId,
      sourceRoom: query.baseId ? { baseId: query.baseId } : undefined,
      assignedSoldierId: query.assignedSoldierId,
      OR: query.search
        ? [
            { taskNumber: { contains: query.search, mode: 'insensitive' } },
            { sourceRoom: { displayName: { contains: query.search, mode: 'insensitive' } } },
          ]
        : undefined,
    };

    // NoCyberHere: AUTHORIZATION
    // Threat: חייל או ראש צוות שמנסה לראות משימות שאינן בתחום ההרשאה שלו
    // Reason: הסינון נאכף בשרת על השאילתה עצמה, ולא בסינון בצד הלקוח.
    if (user.role === UserRole.LOGISTICS_SOLDIER) {
      where.assignedSoldierId = user.id;
    } else if (user.role === UserRole.TEAM_LEAD) {
      where.teamId = { in: user.teamIds.length ? user.teamIds : [NO_MATCH_ID] };
    } else if (query.mine) {
      where.assignedSoldierId = user.id;
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.packingTask.count({ where }),
      this.prisma.packingTask.findMany({
        where,
        include: taskSummaryInclude,
        relationLoadStrategy: 'join',
        orderBy: [{ status: 'asc' }, { priority: 'desc' }, { createdAt: 'desc' }],
        ...toSkipTake(query),
      }),
    ]);

    return paginate(rows.map(toTaskSummary), total, query);
  }

  async get(user: AuthenticatedUser, taskId: string): Promise<PackingTaskDto> {
    const task = await this.loadTask(taskId);
    assertViewTask(user, {
      teamId: task.teamId,
      assignedSoldierId: task.assignedSoldierId,
      sourceBaseId: task.sourceRoom.baseId,
    });
    return toTaskDetail(task);
  }

  /**
   * יצירת משימת אריזה עם שריון אטומי (§8.2).
   * כל הבדיקות והשריונים מתבצעים בתוך transaction אחת:
   * אם פריט אחד אינו זמין, שום דבר לא נשמר.
   */
  async create(user: AuthenticatedUser, input: CreatePackingTaskInput): Promise<PackingTaskDto> {
    const [sourceRoom, destinationRoom, team, soldier, products] = await Promise.all([
      this.prisma.room.findUnique({ where: { id: input.sourceRoomId } }),
      this.prisma.room.findUnique({ where: { id: input.destinationRoomId } }),
      this.prisma.team.findUnique({ where: { id: input.teamId } }),
      this.prisma.user.findUnique({ where: { id: input.assignedSoldierId } }),
      this.prisma.productCatalogItem.findMany({
        where: { id: { in: input.lines.map((line) => line.productCatalogItemId) } },
      }),
    ]);

    if (!sourceRoom || !destinationRoom) throw new AppException('ROOM_NOT_FOUND');
    if (!team) throw new AppException('TEAM_NOT_FOUND');
    if (!soldier || soldier.role !== UserRole.LOGISTICS_SOLDIER || !soldier.isActive) {
      throw new AppException('USER_NOT_FOUND');
    }

    const productById = new Map(products.map((product) => [product.id, product]));
    for (const line of input.lines) {
      const product = productById.get(line.productCatalogItemId);
      if (!product) throw new AppException('CATALOG_ITEM_NOT_FOUND');
      if (product.trackingMode === TrackingMode.SERIALIZED && !line.assetInstanceId) {
        throw new AppException('SERIALIZED_REQUIRES_ASSET');
      }
      if (product.trackingMode === TrackingMode.BULK && line.assetInstanceId) {
        throw new AppException('BULK_FORBIDS_ASSET');
      }
    }

    const taskId = await this.prisma.$transaction(async (tx) => {
      const taskNumber = await nextTaskNumber(tx);

      const task = await tx.packingTask.create({
        data: {
          taskNumber,
          sourceRoomId: input.sourceRoomId,
          destinationRoomId: input.destinationRoomId,
          teamId: input.teamId,
          assignedSoldierId: input.assignedSoldierId,
          createdById: user.id,
          priority: input.priority,
          dueAt: input.dueAt ? new Date(input.dueAt) : null,
          notes: input.notes ?? null,
          status: PackingTaskStatus.ASSIGNED,
          lines: {
            create: input.lines.map((line) => ({
              productCatalogItemId: line.productCatalogItemId,
              assetInstanceId: line.assetInstanceId ?? null,
              requestedQuantity: line.requestedQuantity,
            })),
          },
        },
      });

      for (const line of input.lines) {
        if (line.assetInstanceId) {
          await this.inventory.reserveAsset(
            tx,
            line.assetInstanceId,
            input.sourceRoomId,
            task.id,
          );
        } else {
          await this.inventory.reserveBulk(
            tx,
            input.sourceRoomId,
            line.productCatalogItemId,
            line.requestedQuantity,
          );
        }
      }

      await this.audit.record(
        {
          actorUserId: user.id,
          action: AuditAction.TASK_CREATED,
          entityType: 'PackingTask',
          entityId: task.id,
          after: {
            taskNumber,
            sourceRoomId: input.sourceRoomId,
            destinationRoomId: input.destinationRoomId,
            assignedSoldierId: input.assignedSoldierId,
            lineCount: input.lines.length,
          },
        },
        tx,
      );

      return task.id;
    });

    return toTaskDetail(await this.loadTask(taskId));
  }

  async update(
    user: AuthenticatedUser,
    taskId: string,
    input: UpdatePackingTaskInput,
  ): Promise<PackingTaskDto> {
    const task = await this.loadTask(taskId);

    if (task.status === PackingTaskStatus.COMPLETED || task.status === PackingTaskStatus.CANCELLED) {
      throw new AppException('TASK_INVALID_STATUS');
    }

    if (input.assignedSoldierId) {
      const soldier = await this.prisma.user.findUnique({ where: { id: input.assignedSoldierId } });
      if (!soldier || soldier.role !== UserRole.LOGISTICS_SOLDIER || !soldier.isActive) {
        throw new AppException('USER_NOT_FOUND');
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.packingTask.update({
        where: { id: taskId },
        data: {
          priority: input.priority,
          dueAt: input.dueAt === null ? null : input.dueAt ? new Date(input.dueAt) : undefined,
          notes: input.notes === null ? null : input.notes,
          assignedSoldierId: input.assignedSoldierId,
        },
      });

      await this.audit.record(
        {
          actorUserId: user.id,
          action: AuditAction.TASK_UPDATED,
          entityType: 'PackingTask',
          entityId: taskId,
          before: {
            priority: task.priority,
            dueAt: task.dueAt,
            assignedSoldierId: task.assignedSoldierId,
          },
          after: input,
        },
        tx,
      );
    });

    return toTaskDetail(await this.loadTask(taskId));
  }

  /** התחלת משימה - פעולה מפורשת של החייל המבצע (או של המפקד). */
  async start(user: AuthenticatedUser, taskId: string): Promise<PackingTaskDto> {
    const task = await this.loadTask(taskId);
    const scope = {
      teamId: task.teamId,
      assignedSoldierId: task.assignedSoldierId,
      sourceBaseId: task.sourceRoom.baseId,
    };
    if (!isCommander(user)) assertExecuteTask(user, scope);

    if (task.status === PackingTaskStatus.IN_PROGRESS) {
      return toTaskDetail(task);
    }
    if (!canTransitionTask(task.status as PackingTaskStatus, PackingTaskStatus.IN_PROGRESS)) {
      throw new AppException('TASK_INVALID_STATUS');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.packingTask.update({
        where: { id: taskId },
        data: { status: PackingTaskStatus.IN_PROGRESS, startedAt: new Date() },
      });
      await this.audit.record(
        {
          actorUserId: user.id,
          action: AuditAction.TASK_STARTED,
          entityType: 'PackingTask',
          entityId: taskId,
        },
        tx,
      );
    });

    return toTaskDetail(await this.loadTask(taskId));
  }

  /**
   * ביטול משימה (מפקד בלבד).
   * משחרר רק ציוד שטרם נארז; אם קיימות אריזות פעילות, יש לרוקן אותן קודם (§8.13).
   */
  async cancel(user: AuthenticatedUser, taskId: string, reason?: string): Promise<PackingTaskDto> {
    const task = await this.loadTask(taskId);

    if (!canTransitionTask(task.status as PackingTaskStatus, PackingTaskStatus.CANCELLED)) {
      throw new AppException('TASK_INVALID_STATUS');
    }

    const activePackages = await this.prisma.package.count({
      where: {
        packingTaskId: taskId,
        OR: [{ assets: { some: {} } }, { bulkLines: { some: {} } }],
      },
    });
    if (activePackages > 0) throw new AppException('TASK_HAS_ACTIVE_PACKAGES');

    await this.prisma.$transaction(async (tx) => {
      await this.inventory.releaseUnpackedAssets(tx, taskId);

      const lines = await tx.packingTaskLine.findMany({
        where: { packingTaskId: taskId, assetInstanceId: null },
      });
      for (const line of lines) {
        const remaining = line.requestedQuantity - line.packedQuantity;
        if (remaining > 0) {
          await this.inventory.releaseBulkReservation(
            tx,
            task.sourceRoomId,
            line.productCatalogItemId,
            remaining,
          );
        }
      }

      await tx.packingTask.update({
        where: { id: taskId },
        data: { status: PackingTaskStatus.CANCELLED },
      });

      // אריזות ריקות של משימה מבוטלת נמחקות כדי לא להשאיר מספרים פתוחים.
      await tx.package.deleteMany({ where: { packingTaskId: taskId } });

      await this.audit.record(
        {
          actorUserId: user.id,
          action: AuditAction.TASK_CANCELLED,
          entityType: 'PackingTask',
          entityId: taskId,
          metadata: { reason: reason ?? null },
        },
        tx,
      );
    });

    return toTaskDetail(await this.loadTask(taskId));
  }

  /**
   * בודק אם כל שורות המשימה נארזו, ואם כן מעביר אותה ל-COMPLETED.
   * נקרא מתוך transaction של סגירת אריזה.
   */
  async completeIfFullyPacked(
    tx: Prisma.TransactionClient,
    taskId: string,
    actorUserId: string,
  ): Promise<boolean> {
    const task = await tx.packingTask.findUnique({
      where: { id: taskId },
      include: { lines: true },
    });
    if (!task || task.status !== PackingTaskStatus.IN_PROGRESS) return false;

    const fullyPacked = task.lines.every((line) => line.packedQuantity >= line.requestedQuantity);
    if (!fullyPacked) return false;

    await tx.packingTask.update({
      where: { id: taskId },
      data: { status: PackingTaskStatus.COMPLETED, completedAt: new Date() },
    });
    await this.audit.record(
      {
        actorUserId,
        action: AuditAction.TASK_COMPLETED,
        entityType: 'PackingTask',
        entityId: taskId,
      },
      tx,
    );
    return true;
  }

  /** מסמן משימה כ-IN_PROGRESS בעת יצירת האריזה הראשונה (§8.12). */
  async markInProgress(
    tx: Prisma.TransactionClient,
    taskId: string,
    actorUserId: string,
  ): Promise<void> {
    const task = await tx.packingTask.findUnique({ where: { id: taskId } });
    if (!task || task.status !== PackingTaskStatus.ASSIGNED) return;

    await tx.packingTask.update({
      where: { id: taskId },
      data: { status: PackingTaskStatus.IN_PROGRESS, startedAt: task.startedAt ?? new Date() },
    });
    await this.audit.record(
      {
        actorUserId,
        action: AuditAction.TASK_STARTED,
        entityType: 'PackingTask',
        entityId: taskId,
        metadata: { trigger: 'FIRST_PACKAGE' },
      },
      tx,
    );
  }

  private async loadTask(taskId: string): Promise<TaskDetailRow> {
    const task = await this.prisma.packingTask.findUnique({
      where: { id: taskId },
      include: taskDetailInclude,
      relationLoadStrategy: 'join',
    });
    if (!task) throw new AppException('TASK_NOT_FOUND');
    return task;
  }
}

/** מזהה שלא יתאים לאף רשומה - משמש לסגירת שאילתה כאשר אין תחום הרשאה. */
const NO_MATCH_ID = '00000000-0000-0000-0000-000000000000';
