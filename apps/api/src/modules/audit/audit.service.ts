import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  AUDIT_ACTION_LABEL,
  AuditAction,
  AuditLogDto,
  AuditLogsQuery,
  PaginatedResult,
} from '@south/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { redact } from '../../common/logging/redact';
import { paginate, toSkipTake } from '../../common/utils/pagination.util';

export interface AuditRecordInput {
  actorUserId: string | null;
  action: AuditAction | string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
}

/**
 * NoCyberHere: SECURITY_LOGGING
 * Threat: חוסר יכולת לשחזר מי שינה מה, ומתי, בחקירת אירוע
 * Reason: תיעוד פעולות משמעותיות (§7.16). כל אובייקט עובר redact,
 *         כך שסיסמאות, Tokens ומספרי זהות מלאים לא נשמרים.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger('Audit');

  constructor(private readonly prisma: PrismaService) {}

  /** רישום Audit. אפשר להעביר transaction client כדי לשמור אטומיות עם שינוי הנתונים. */
  async record(input: AuditRecordInput, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx ?? this.prisma;
    try {
      await client.auditLog.create({
        data: {
          actorUserId: input.actorUserId,
          action: input.action,
          entityType: input.entityType,
          entityId: input.entityId ?? null,
          beforeJson: input.before ? (redact(input.before) as Prisma.InputJsonValue) : undefined,
          afterJson: input.after ? (redact(input.after) as Prisma.InputJsonValue) : undefined,
          metadata: input.metadata
            ? (redact(input.metadata) as Prisma.InputJsonValue)
            : undefined,
        },
      });
    } catch (error) {
      // כישלון ברישום Audit לא אמור להפיל פעולה עסקית שכבר הושלמה,
      // אבל הוא חייב להיראות בלוג.
      if (tx) throw error;
      this.logger.error(`כשל ברישום Audit לפעולה ${input.action}`);
    }
  }

  async list(query: AuditLogsQuery): Promise<PaginatedResult<AuditLogDto>> {
    const where: Prisma.AuditLogWhereInput = {
      entityType: query.entityType,
      entityId: query.entityId,
      actorUserId: query.actorUserId,
      action: query.action,
      createdAt:
        query.from || query.to
          ? {
              gte: query.from ? new Date(query.from) : undefined,
              lte: query.to ? new Date(query.to) : undefined,
            }
          : undefined,
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: { actor: { select: { fullName: true } } },
        ...toSkipTake(query),
      }),
    ]);

    const items: AuditLogDto[] = rows.map((row) => ({
      id: row.id,
      actorUserId: row.actorUserId,
      actorName: row.actor?.fullName ?? null,
      action: row.action,
      actionLabel: AUDIT_ACTION_LABEL[row.action as AuditAction] ?? row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      metadata: (row.metadata as Record<string, unknown>) ?? null,
      createdAt: row.createdAt.toISOString(),
    }));

    return paginate(items, total, query);
  }
}
