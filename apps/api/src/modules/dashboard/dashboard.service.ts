import { Injectable } from '@nestjs/common';
import {
  AssetStatus,
  BaseProgressDto,
  CommanderDashboardDto,
  JoinRequestStatus,
  MissionStatus,
  PACKAGE_STATUSES,
  PACKAGE_STATUS_LABEL,
  PackageStatus,
  PackingTaskStatus,
  SoldierDashboardDto,
  StatusCountDto,
  StopType,
  TaskPriority,
  TeamLeadDashboardDto,
} from '@south/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { joinRequestInclude, missionSummaryInclude, toJoinRequestDto, toMissionSummary } from '../missions/mission.mapper';
import { packageSummaryInclude, toPackageSummary } from '../packages/package.mapper';
import { taskSummaryInclude, toTaskSummary } from '../packing-tasks/packing-task.mapper';

/**
 * מדדי ה-Dashboard (§15).
 * כל החישובים מתבצעים בשרת בשאילתות צוברות, ולא בטעינת כל הרשומות ללקוח.
 */
/** סטטוסים שמעידים שהפריט כבר יצא מהחדר לכיוון היעד. */
const MOVED_ASSET_STATUSES: AssetStatus[] = [
  AssetStatus.PACKED,
  AssetStatus.IN_TRANSIT,
  AssetStatus.RECEIVED,
  AssetStatus.DELIVERED,
];

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async commander(): Promise<CommanderDashboardDto> {
    const [taskGroups, packageGroups, missionGroups, bases, urgentTasks, joinRequests, nextMission] =
      await Promise.all([
        this.prisma.packingTask.groupBy({ by: ['status'], _count: { _all: true } }),
        this.prisma.package.groupBy({ by: ['status'], _count: { _all: true } }),
        this.prisma.transportMission.groupBy({ by: ['status'], _count: { _all: true } }),
        this.prisma.base.findMany({ orderBy: { name: 'asc' } }),
        this.prisma.packingTask.findMany({
          where: {
            status: { in: [PackingTaskStatus.ASSIGNED, PackingTaskStatus.IN_PROGRESS] },
            priority: { in: [TaskPriority.HIGH, TaskPriority.URGENT] },
          },
          include: taskSummaryInclude,
          relationLoadStrategy: 'join',
          orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
          take: 5,
        }),
        this.prisma.missionJoinRequest.findMany({
          where: { status: JoinRequestStatus.PENDING },
          include: joinRequestInclude,
          relationLoadStrategy: 'join',
          orderBy: { createdAt: 'asc' },
          take: 10,
        }),
        this.prisma.transportMission.findFirst({
          where: { status: { in: [MissionStatus.PLANNED, MissionStatus.LOADING] } },
          include: missionSummaryInclude,
          relationLoadStrategy: 'join',
          orderBy: { plannedDepartureAt: 'asc' },
        }),
      ]);

    const taskCount = (status: PackingTaskStatus): number =>
      taskGroups.find((group) => group.status === status)?._count._all ?? 0;
    const packageCount = (status: PackageStatus): number =>
      packageGroups.find((group) => group.status === status)?._count._all ?? 0;
    const missionCount = (status: MissionStatus): number =>
      missionGroups.find((group) => group.status === status)?._count._all ?? 0;

    const totalTasks = taskGroups.reduce((sum, group) => sum + group._count._all, 0);
    const totalPackages = packageGroups.reduce((sum, group) => sum + group._count._all, 0);
    const deliveredPackages = packageCount(PackageStatus.DELIVERED_TO_ROOM);

    const [baseProgress, equipmentPackedPercent, timings, tripsSaved] = await Promise.all([
      this.baseProgress(bases),
      this.equipmentPackedPercent(),
      this.averageTimings(),
      this.estimatedTripsSaved(),
    ]);

    return {
      tasks: {
        assigned: taskCount(PackingTaskStatus.ASSIGNED),
        inProgress: taskCount(PackingTaskStatus.IN_PROGRESS),
        completed: taskCount(PackingTaskStatus.COMPLETED),
        cancelled: taskCount(PackingTaskStatus.CANCELLED),
        completionPercent:
          totalTasks === 0
            ? 0
            : Math.round((taskCount(PackingTaskStatus.COMPLETED) / totalTasks) * 100),
        urgentOpen: urgentTasks.length,
      },
      packages: {
        byStatus: this.packageStatusCounts(packageGroups),
        total: totalPackages,
        inTransit: packageCount(PackageStatus.IN_TRANSIT),
        readyWaiting: packageCount(PackageStatus.READY_FOR_SHIPMENT),
      },
      missions: {
        planned: missionCount(MissionStatus.PLANNED),
        loading: missionCount(MissionStatus.LOADING),
        inTransit: missionCount(MissionStatus.IN_TRANSIT),
        unloading: missionCount(MissionStatus.UNLOADING),
        completed: missionCount(MissionStatus.COMPLETED),
      },
      overallProgressPercent:
        totalPackages === 0 ? 0 : Math.round((deliveredPackages / totalPackages) * 100),
      equipmentPackedPercent,
      averageTaskToSealMinutes: timings.taskToSeal,
      averageReadyToDepartMinutes: timings.readyToDepart,
      estimatedTripsSaved: tripsSaved,
      baseProgress,
      urgentTasks: urgentTasks.map(toTaskSummary),
      pendingJoinRequests: joinRequests.map(toJoinRequestDto),
      nextMission: nextMission ? toMissionSummary(nextMission) : null,
    };
  }

  async soldier(user: AuthenticatedUser): Promise<SoldierDashboardDto> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [activeTasks, completedToday, openPackages, readyPackages, myMissions, joinable, requests] =
      await Promise.all([
        this.prisma.packingTask.findMany({
          where: {
            assignedSoldierId: user.id,
            status: { in: [PackingTaskStatus.ASSIGNED, PackingTaskStatus.IN_PROGRESS] },
          },
          include: taskSummaryInclude,
          relationLoadStrategy: 'join',
          orderBy: [{ priority: 'desc' }, { dueAt: 'asc' }, { createdAt: 'asc' }],
        }),
        this.prisma.packingTask.count({
          where: {
            assignedSoldierId: user.id,
            status: PackingTaskStatus.COMPLETED,
            completedAt: { gte: startOfDay },
          },
        }),
        this.prisma.package.findMany({
          where: { task: { assignedSoldierId: user.id }, status: PackageStatus.OPEN },
          include: packageSummaryInclude,
          relationLoadStrategy: 'join',
          orderBy: { createdAt: 'desc' },
          take: 10,
        }),
        this.prisma.package.count({
          where: {
            task: { assignedSoldierId: user.id },
            status: PackageStatus.READY_FOR_SHIPMENT,
          },
        }),
        this.prisma.transportMission.findMany({
          where: {
            assignedSoldierId: user.id,
            status: {
              in: [
                MissionStatus.PLANNED,
                MissionStatus.LOADING,
                MissionStatus.IN_TRANSIT,
                MissionStatus.UNLOADING,
              ],
            },
          },
          include: missionSummaryInclude,
          relationLoadStrategy: 'join',
          orderBy: { plannedDepartureAt: 'asc' },
        }),
        user.baseId
          ? this.prisma.transportMission.findMany({
              where: {
                status: MissionStatus.PLANNED,
                assignedSoldierId: { not: user.id },
                plannedDepartureAt: { gte: new Date() },
              },
              include: missionSummaryInclude,
              relationLoadStrategy: 'join',
              orderBy: { plannedDepartureAt: 'asc' },
              take: 5,
            })
          : Promise.resolve([]),
        this.prisma.missionJoinRequest.findMany({
          where: { requestingUserId: user.id, status: JoinRequestStatus.PENDING },
          include: joinRequestInclude,
          relationLoadStrategy: 'join',
          orderBy: { createdAt: 'desc' },
          take: 5,
        }),
      ]);

    return {
      nextTask: activeTasks.length > 0 ? toTaskSummary(activeTasks[0]) : null,
      activeTasks: activeTasks.map(toTaskSummary),
      completedTodayCount: completedToday,
      openPackages: openPackages.map(toPackageSummary),
      readyPackages,
      myMissions: myMissions.map(toMissionSummary),
      joinableMissions: joinable.map(toMissionSummary),
      pendingJoinRequests: requests.map(toJoinRequestDto),
    };
  }

  async teamLead(user: AuthenticatedUser): Promise<TeamLeadDashboardDto> {
    const teamIds = user.teamIds.length ? user.teamIds : ['00000000-0000-0000-0000-000000000000'];

    const [teams, groups, recent, assetsCount] = await Promise.all([
      this.prisma.team.findMany({ where: { id: { in: teamIds } }, select: { name: true } }),
      this.prisma.package.groupBy({
        by: ['status'],
        where: { teamId: { in: teamIds } },
        _count: { _all: true },
      }),
      this.prisma.package.findMany({
        where: { teamId: { in: teamIds } },
        include: packageSummaryInclude,
        relationLoadStrategy: 'join',
        orderBy: { updatedAt: 'desc' },
        take: 12,
      }),
      this.prisma.packageAsset.count({ where: { package: { teamId: { in: teamIds } } } }),
    ]);

    const total = groups.reduce((sum, group) => sum + group._count._all, 0);
    const delivered =
      groups.find((group) => group.status === PackageStatus.DELIVERED_TO_ROOM)?._count._all ?? 0;
    const inTransit =
      groups.find((group) => group.status === PackageStatus.IN_TRANSIT)?._count._all ?? 0;

    return {
      teamNames: teams.map((team) => team.name),
      packagesByStatus: this.packageStatusCounts(groups),
      totalPackages: total,
      deliveredPackages: delivered,
      inTransitPackages: inTransit,
      assetsCount,
      recentPackages: recent.map(toPackageSummary),
      progressPercent: total === 0 ? 0 : Math.round((delivered / total) * 100),
    };
  }

  // ---------- עזרים ----------

  private packageStatusCounts(
    groups: Array<{ status: string; _count: { _all: number } }>,
  ): StatusCountDto[] {
    return PACKAGE_STATUSES.map((status) => ({
      status,
      label: PACKAGE_STATUS_LABEL[status],
      count: groups.find((group) => group.status === status)?._count._all ?? 0,
    }));
  }

  private async baseProgress(
    bases: Array<{ id: string; code: string; name: string }>,
  ): Promise<BaseProgressDto[]> {
    const [packageGroups, taskGroups] = await Promise.all([
      this.prisma.package.groupBy({
        by: ['status', 'sourceRoomId'],
        _count: { _all: true },
      }),
      this.prisma.packingTask.groupBy({
        by: ['status', 'sourceRoomId'],
        _count: { _all: true },
      }),
    ]);

    const rooms = await this.prisma.room.findMany({ select: { id: true, baseId: true } });
    const baseByRoom = new Map(rooms.map((room) => [room.id, room.baseId]));

    return bases.map((base) => {
      let totalPackages = 0;
      let deliveredPackages = 0;
      let inTransitPackages = 0;
      let readyPackages = 0;
      let openTasks = 0;

      for (const group of packageGroups) {
        if (baseByRoom.get(group.sourceRoomId) !== base.id) continue;
        totalPackages += group._count._all;
        if (group.status === PackageStatus.DELIVERED_TO_ROOM) {
          deliveredPackages += group._count._all;
        } else if (group.status === PackageStatus.IN_TRANSIT) {
          inTransitPackages += group._count._all;
        } else if (group.status === PackageStatus.READY_FOR_SHIPMENT) {
          readyPackages += group._count._all;
        }
      }

      for (const group of taskGroups) {
        if (baseByRoom.get(group.sourceRoomId) !== base.id) continue;
        if (
          group.status === PackingTaskStatus.ASSIGNED ||
          group.status === PackingTaskStatus.IN_PROGRESS
        ) {
          openTasks += group._count._all;
        }
      }

      return {
        baseId: base.id,
        baseCode: base.code,
        baseName: base.name,
        totalPackages,
        deliveredPackages,
        inTransitPackages,
        readyPackages,
        openTasks,
        percentDelivered:
          totalPackages === 0 ? 0 : Math.round((deliveredPackages / totalPackages) * 100),
      };
    });
  }

  /** אחוז הציוד שנארז מתוך המיפוי. הערכה המבוססת על מוני המלאי ועל סטטוס הפריטים. */
  private async equipmentPackedPercent(): Promise<number> {
    const [inventory, assetGroups] = await Promise.all([
      this.prisma.roomInventory.aggregate({
        _sum: { mappedQuantity: true, packedQuantity: true, deliveredQuantity: true },
      }),
      this.prisma.assetInstance.groupBy({ by: ['status'], _count: { _all: true } }),
    ]);

    const mappedBulk = inventory._sum.mappedQuantity ?? 0;
    const packedBulk = (inventory._sum.packedQuantity ?? 0) + (inventory._sum.deliveredQuantity ?? 0);

    const totalAssets = assetGroups.reduce((sum, group) => sum + group._count._all, 0);
    const movedAssets = assetGroups
      .filter((group) => MOVED_ASSET_STATUSES.includes(group.status as AssetStatus))
      .reduce((sum, group) => sum + group._count._all, 0);

    const totalUnits = mappedBulk + totalAssets;
    const movedUnits = packedBulk + movedAssets;
    return totalUnits === 0 ? 0 : Math.round((movedUnits / totalUnits) * 100);
  }

  private async averageTimings(): Promise<{
    taskToSeal: number | null;
    readyToDepart: number | null;
  }> {
    const sealed = await this.prisma.package.findMany({
      where: { sealedAt: { not: null } },
      select: { sealedAt: true, departedAt: true, task: { select: { createdAt: true } } },
      orderBy: { sealedAt: 'desc' },
      take: 200,
    });

    const taskToSealValues = sealed
      .filter((pkg) => pkg.sealedAt)
      .map((pkg) => (pkg.sealedAt!.getTime() - pkg.task.createdAt.getTime()) / 60000)
      .filter((minutes) => minutes >= 0);

    const readyToDepartValues = sealed
      .filter((pkg) => pkg.sealedAt && pkg.departedAt)
      .map((pkg) => (pkg.departedAt!.getTime() - pkg.sealedAt!.getTime()) / 60000)
      .filter((minutes) => minutes >= 0);

    const average = (values: number[]): number | null =>
      values.length === 0
        ? null
        : Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);

    return { taskToSeal: average(taskToSealValues), readyToDepart: average(readyToDepartValues) };
  }

  /**
   * הערכת נסיעות שנחסכו: כל בסיס איסוף נוסף באותה שליחות חוסך נסיעה נפרדת.
   * מוצג כהערכה בלבד (§15).
   */
  private async estimatedTripsSaved(): Promise<number> {
    const missions = await this.prisma.transportMission.findMany({
      where: { status: { notIn: [MissionStatus.CANCELLED, MissionStatus.DRAFT] } },
      select: { stops: { where: { stopType: StopType.PICKUP }, select: { id: true } } },
    });
    return missions.reduce((sum, mission) => sum + Math.max(0, mission.stops.length - 1), 0);
  }
}
