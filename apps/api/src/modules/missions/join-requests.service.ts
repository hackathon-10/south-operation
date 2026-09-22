import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  AuditAction,
  CreateJoinRequestInput,
  JoinRequestDto,
  JoinRequestStatus,
  MissionStatus,
  PackageStatus,
  PaginatedResult,
  StopStatus,
  UserRole,
} from '@south/shared';
import { AppException } from '../../common/errors/app.exception';
import { PrismaService } from '../../common/prisma/prisma.service';
import { paginate, toSkipTake } from '../../common/utils/pagination.util';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { JoinRequestRow, joinRequestInclude, toJoinRequestDto } from './mission.mapper';
import { MissionsService } from './missions.service';

/**
 * בקשת חייל להוסיף עצירת איסוף ואריזות לשליחות מתוכננת (§8.7).
 * האישור מעדכן עצירות, משייך אריזות ומחשב מסלול מחדש - הכל ב-transaction אחת.
 */
@Injectable()
export class JoinRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly missions: MissionsService,
    private readonly audit: AuditService,
  ) {}

  async list(
    user: AuthenticatedUser,
    query: {
      page: number;
      pageSize: number;
      status?: JoinRequestStatus;
      transportMissionId?: string;
      baseId?: string;
      mine?: boolean;
    },
  ): Promise<PaginatedResult<JoinRequestDto>> {
    const where: Prisma.MissionJoinRequestWhereInput = {
      status: query.status,
      transportMissionId: query.transportMissionId,
      baseId: query.baseId,
    };

    if (user.role === UserRole.TEAM_LEAD) throw new AppException('FORBIDDEN_ROLE');
    if (user.role === UserRole.LOGISTICS_SOLDIER || query.mine) {
      where.requestingUserId = user.id;
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.missionJoinRequest.count({ where }),
      this.prisma.missionJoinRequest.findMany({
        where,
        include: joinRequestInclude,
        relationLoadStrategy: 'join',
        orderBy: { createdAt: 'desc' },
        ...toSkipTake(query),
      }),
    ]);

    return paginate(rows.map(toJoinRequestDto), total, query);
  }

  async create(
    user: AuthenticatedUser,
    missionId: string,
    input: CreateJoinRequestInput,
  ): Promise<JoinRequestDto> {
    if (!user.baseId) throw new AppException('FORBIDDEN_BASE_SCOPE');

    const mission = await this.missions.loadMission(missionId);
    if (mission.status !== MissionStatus.PLANNED) {
      throw new AppException('MISSION_INVALID_STATUS');
    }

    const packages = await this.prisma.package.findMany({
      where: { id: { in: input.packageIds } },
      include: { sourceRoom: { select: { baseId: true } }, missionPackage: true },
    });
    if (packages.length !== input.packageIds.length) throw new AppException('PACKAGE_NOT_FOUND');

    for (const pkg of packages) {
      // NoCyberHere: AUTHORIZATION
      // Threat: חייל שמנסה לצרף אריזות של בסיס אחר לשליחות
      // Reason: הבקשה מוגבלת לאריזות מוכנות מהבסיס של המבקש בלבד.
      if (pkg.sourceRoom.baseId !== user.baseId) throw new AppException('FORBIDDEN_BASE_SCOPE');
      if (pkg.missionPackage) throw new AppException('PACKAGE_ALREADY_IN_MISSION');
      if (pkg.status !== PackageStatus.READY_FOR_SHIPMENT) {
        throw new AppException('PACKAGE_INVALID_STATUS');
      }
    }

    const requestId = await this.prisma.$transaction(async (tx) => {
      const request = await tx.missionJoinRequest.create({
        data: {
          transportMissionId: missionId,
          requestingUserId: user.id,
          baseId: user.baseId!,
          status: JoinRequestStatus.PENDING,
          note: input.note ?? null,
          packages: {
            create: input.packageIds.map((packageId) => ({ packageId })),
          },
        },
      });

      await this.audit.record(
        {
          actorUserId: user.id,
          action: AuditAction.JOIN_REQUEST_CREATED,
          entityType: 'MissionJoinRequest',
          entityId: request.id,
          after: { missionId, packageCount: input.packageIds.length },
        },
        tx,
      );

      return request.id;
    });

    return this.get(requestId);
  }

  /** אישור הבקשה: הוספה או איחוד של עצירת איסוף, שיוך אריזות וחישוב מסלול מחדש. */
  async approve(
    user: AuthenticatedUser,
    requestId: string,
    note?: string,
  ): Promise<JoinRequestDto> {
    const request = await this.loadRequest(requestId);
    if (request.status !== JoinRequestStatus.PENDING) {
      throw new AppException('JOIN_REQUEST_INVALID_STATUS');
    }

    const mission = await this.missions.loadMission(request.transportMissionId);
    if (mission.status !== MissionStatus.PLANNED) {
      throw new AppException('MISSION_INVALID_STATUS');
    }
    if (mission.stops.some((stop) => stop.status !== StopStatus.PLANNED)) {
      // אי אפשר לאשר בקשה אחרי שהחלה ההעמסה.
      throw new AppException('MISSION_INVALID_STATUS');
    }

    const packageIds = request.packages.map((item) => item.packageId);
    const packages = await this.missions.loadAssignablePackages(packageIds);

    await this.prisma.$transaction(async (tx) => {
      await this.missions.attachPackages(tx, mission, packages, user.id);
      await this.missions.recalculateRoute(tx, mission.id, user.id);

      await tx.missionJoinRequest.update({
        where: { id: requestId },
        data: {
          status: JoinRequestStatus.APPROVED,
          reviewedById: user.id,
          reviewedAt: new Date(),
          note: note ?? request.note,
        },
      });

      await this.audit.record(
        {
          actorUserId: user.id,
          action: AuditAction.JOIN_REQUEST_APPROVED,
          entityType: 'MissionJoinRequest',
          entityId: requestId,
          after: { missionId: mission.id, packageCount: packages.length },
        },
        tx,
      );
    });

    return this.get(requestId);
  }

  async reject(user: AuthenticatedUser, requestId: string, note?: string): Promise<JoinRequestDto> {
    const request = await this.loadRequest(requestId);
    if (request.status !== JoinRequestStatus.PENDING) {
      throw new AppException('JOIN_REQUEST_INVALID_STATUS');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.missionJoinRequest.update({
        where: { id: requestId },
        data: {
          status: JoinRequestStatus.REJECTED,
          reviewedById: user.id,
          reviewedAt: new Date(),
          note: note ?? request.note,
        },
      });
      await this.audit.record(
        {
          actorUserId: user.id,
          action: AuditAction.JOIN_REQUEST_REJECTED,
          entityType: 'MissionJoinRequest',
          entityId: requestId,
          metadata: { note: note ?? null },
        },
        tx,
      );
    });

    return this.get(requestId);
  }

  async get(requestId: string): Promise<JoinRequestDto> {
    return toJoinRequestDto(await this.loadRequest(requestId));
  }

  private async loadRequest(requestId: string): Promise<JoinRequestRow> {
    const request = await this.prisma.missionJoinRequest.findUnique({
      where: { id: requestId },
      include: joinRequestInclude,
      relationLoadStrategy: 'join',
    });
    if (!request) throw new AppException('JOIN_REQUEST_NOT_FOUND');
    return request;
  }
}
