import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AssetDto,
  BaseDto,
  CatalogItemDto,
  CommanderDashboardDto,
  CreateJoinRequestInput,
  CreateMissionInput,
  CreatePackingTaskInput,
  FloorMapDetailsDto,
  FloorMapSummaryDto,
  JoinRequestDto,
  MissionDto,
  MissionSummaryDto,
  OperationDashboardDto,
  PackageDto,
  PackageLabelDto,
  PackageScanResultDto,
  PackageSummaryDto,
  PackingTaskDto,
  PackingTaskSummaryDto,
  PaginatedResult,
  RoomDto,
  RoomInventoryDto,
  RoomMapSearchHitDto,
  RoomPanelDto,
  RouteSuggestionDto,
  SoldierDashboardDto,
  TeamDto,
  TeamLeadDashboardDto,
  UpdateMissionInput,
} from '@south/shared';
import { api } from './client';

type Params = Record<string, string | number | boolean | undefined | null>;

function clean(params?: Params): Params | undefined {
  if (!params) return undefined;
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  );
}

async function get<T>(url: string, params?: Params): Promise<T> {
  const response = await api.get<T>(url, { params: clean(params) });
  return response.data;
}

async function post<T>(url: string, body?: unknown): Promise<T> {
  const response = await api.post<T>(url, body ?? {});
  return response.data;
}

async function patch<T>(url: string, body?: unknown): Promise<T> {
  const response = await api.patch<T>(url, body ?? {});
  return response.data;
}

async function remove<T>(url: string): Promise<T> {
  const response = await api.delete<T>(url);
  return response.data;
}

export const queryKeys = {
  dashboardCommander: ['dashboard', 'commander'] as const,
  dashboardSoldier: ['dashboard', 'soldier'] as const,
  dashboardTeamLead: ['dashboard', 'team-lead'] as const,
  dashboardOperation: ['dashboard', 'operation'] as const,
  bases: ['bases'] as const,
  teams: (params?: Params) => ['teams', params] as const,
  rooms: (params?: Params) => ['rooms', params] as const,
  roomInventory: (roomId: string) => ['rooms', roomId, 'inventory'] as const,
  roomPanel: (roomId: string) => ['rooms', roomId, 'panel'] as const,
  floorMaps: (params?: Params) => ['floor-maps', params] as const,
  floorMap: (id: string) => ['floor-maps', id] as const,
  floorMapSearch: (query: string) => ['floor-maps', 'search', query] as const,
  catalog: (params?: Params) => ['catalog', params] as const,
  assets: (params?: Params) => ['assets', params] as const,
  tasks: (params?: Params) => ['tasks', params] as const,
  task: (id: string) => ['tasks', id] as const,
  packages: (params?: Params) => ['packages', params] as const,
  package: (id: string) => ['packages', id] as const,
  packageLabel: (id: string) => ['packages', id, 'label'] as const,
  scan: (token: string) => ['scan', token] as const,
  missions: (params?: Params) => ['missions', params] as const,
  mission: (id: string) => ['missions', id] as const,
  joinRequests: (params?: Params) => ['join-requests', params] as const,
};

/** רענון רחב אחרי פעולה שמשנה מצב עסקי. */
function useInvalidateOperational() {
  const queryClient = useQueryClient();
  return () => {
    for (const key of ['dashboard', 'tasks', 'packages', 'missions', 'join-requests', 'floor-maps', 'rooms', 'assets']) {
      void queryClient.invalidateQueries({ queryKey: [key] });
    }
  };
}

// ==================== Dashboards ====================

export const useCommanderDashboard = () =>
  useQuery({
    queryKey: queryKeys.dashboardCommander,
    queryFn: () => get<CommanderDashboardDto>('/dashboard/commander'),
    refetchInterval: 60_000,
  });

export const useSoldierDashboard = () =>
  useQuery({
    queryKey: queryKeys.dashboardSoldier,
    queryFn: () => get<SoldierDashboardDto>('/dashboard/soldier'),
    refetchInterval: 60_000,
  });

export const useTeamLeadDashboard = () =>
  useQuery({
    queryKey: queryKeys.dashboardTeamLead,
    queryFn: () => get<TeamLeadDashboardDto>('/dashboard/team-lead'),
    refetchInterval: 60_000,
  });

/**
 * תמונת המאקרו של מפקד המבצע.
 * רענון תכוף יותר משאר הדשבורדים - זה מסך שנשאר פתוח על קיר.
 */
export const useOperationDashboard = () =>
  useQuery({
    queryKey: queryKeys.dashboardOperation,
    queryFn: () => get<OperationDashboardDto>('/dashboard/operation'),
    refetchInterval: 30_000,
  });

// ==================== Reference data ====================

export const useBases = () =>
  useQuery({ queryKey: queryKeys.bases, queryFn: () => get<BaseDto[]>('/bases'), staleTime: 300_000 });

export const useTeams = (params?: Params) =>
  useQuery({
    queryKey: queryKeys.teams(params),
    queryFn: () => get<TeamDto[]>('/teams', params),
    staleTime: 300_000,
  });

export const useRooms = (params?: Params, enabled = true) =>
  useQuery({
    queryKey: queryKeys.rooms(params),
    queryFn: () => get<PaginatedResult<RoomDto>>('/rooms', params),
    enabled,
  });

export const useRoomInventory = (roomId?: string) =>
  useQuery({
    queryKey: queryKeys.roomInventory(roomId ?? ''),
    queryFn: () => get<RoomInventoryDto>(`/rooms/${roomId}/inventory`),
    enabled: Boolean(roomId),
  });

export const useRoomPanel = (roomId?: string) =>
  useQuery({
    queryKey: queryKeys.roomPanel(roomId ?? ''),
    queryFn: () => get<RoomPanelDto>(`/rooms/${roomId}/panel`),
    enabled: Boolean(roomId),
  });

export const useFloorMaps = (params?: Params) =>
  useQuery({
    queryKey: queryKeys.floorMaps(params),
    queryFn: () => get<FloorMapSummaryDto[]>('/floor-maps', params),
    staleTime: 300_000,
  });

export const useFloorMap = (floorMapId?: string) =>
  useQuery({
    queryKey: queryKeys.floorMap(floorMapId ?? ''),
    queryFn: () => get<FloorMapDetailsDto>(`/floor-maps/${floorMapId}`),
    enabled: Boolean(floorMapId),
  });

export const useFloorMapSearch = (query: string, params?: Params) =>
  useQuery({
    queryKey: queryKeys.floorMapSearch(query),
    queryFn: () => get<RoomMapSearchHitDto[]>('/floor-maps/search', { ...params, query }),
    enabled: query.trim().length >= 2,
  });

export interface UserSummary {
  id: string;
  fullName: string;
  email: string;
  role: string;
  baseId: string | null;
  baseName: string | null;
  teamId: string | null;
  teamName: string | null;
}

/** רשימת משתמשים לשיוך חייל מבצע. זמינה למפקד בלבד (נאכף בשרת). */
export const useUsers = (params?: Params, enabled = true) =>
  useQuery({
    queryKey: ['users', params] as const,
    queryFn: () => get<PaginatedResult<UserSummary>>('/users', params),
    enabled,
    staleTime: 300_000,
  });

/**
 * מועמדים לאחראי על אריזה - אנשי הצוות של המשימה והחייל המשובץ.
 * נפרד מ-useUsers, שנגיש למפקד בלבד.
 */
export const useResponsibleCandidates = (taskId: string | undefined) =>
  useQuery({
    queryKey: ['responsible-candidates', taskId] as const,
    queryFn: () =>
      get<Array<{ id: string; fullName: string; role: string }>>(
        `/packing-tasks/${taskId}/responsible-candidates`,
      ),
    enabled: Boolean(taskId),
    staleTime: 300_000,
  });

export const useCatalogItems = (params?: Params) =>
  useQuery({
    queryKey: queryKeys.catalog(params),
    queryFn: () => get<PaginatedResult<CatalogItemDto>>('/catalog/items', params),
  });

export const useAssets = (params?: Params, enabled = true) =>
  useQuery({
    queryKey: queryKeys.assets(params),
    queryFn: () => get<PaginatedResult<AssetDto>>('/assets', params),
    enabled,
  });

// ==================== Packing tasks ====================

export const useTasks = (params?: Params) =>
  useQuery({
    queryKey: queryKeys.tasks(params),
    queryFn: () => get<PaginatedResult<PackingTaskSummaryDto>>('/packing-tasks', params),
  });

export const useTask = (taskId?: string) =>
  useQuery({
    queryKey: queryKeys.task(taskId ?? ''),
    queryFn: () => get<PackingTaskDto>(`/packing-tasks/${taskId}`),
    enabled: Boolean(taskId),
  });

export const useCreateTask = () => {
  const invalidate = useInvalidateOperational();
  return useMutation({
    mutationFn: (input: CreatePackingTaskInput) => post<PackingTaskDto>('/packing-tasks', input),
    onSuccess: invalidate,
  });
};

export const useStartTask = () => {
  const invalidate = useInvalidateOperational();
  return useMutation({
    mutationFn: (taskId: string) => post<PackingTaskDto>(`/packing-tasks/${taskId}/start`),
    onSuccess: invalidate,
  });
};

export const useCancelTask = () => {
  const invalidate = useInvalidateOperational();
  return useMutation({
    mutationFn: ({ taskId, reason }: { taskId: string; reason?: string }) =>
      post<PackingTaskDto>(`/packing-tasks/${taskId}/cancel`, { reason }),
    onSuccess: invalidate,
  });
};

// ==================== Packages ====================

export const usePackages = (params?: Params, enabled = true) =>
  useQuery({
    queryKey: queryKeys.packages(params),
    queryFn: () => get<PaginatedResult<PackageSummaryDto>>('/packages', params),
    enabled,
  });

export const usePackage = (packageId?: string) =>
  useQuery({
    queryKey: queryKeys.package(packageId ?? ''),
    queryFn: () => get<PackageDto>(`/packages/${packageId}`),
    enabled: Boolean(packageId),
  });

export const usePackageLabel = (packageId?: string) =>
  useQuery({
    queryKey: queryKeys.packageLabel(packageId ?? ''),
    queryFn: () => get<PackageLabelDto>(`/packages/${packageId}/label`),
    enabled: Boolean(packageId),
  });

export const useScanPackage = (publicToken?: string) =>
  useQuery({
    queryKey: queryKeys.scan(publicToken ?? ''),
    queryFn: () => get<PackageScanResultDto>(`/scan/packages/${publicToken}`),
    enabled: Boolean(publicToken),
    retry: false,
  });

export const useCreatePackage = () => {
  const invalidate = useInvalidateOperational();
  return useMutation({
    mutationFn: ({
      taskId,
      packageType,
      responsibleUserId,
    }: {
      taskId: string;
      packageType: string;
      responsibleUserId: string;
    }) => post<PackageDto>(`/packing-tasks/${taskId}/packages`, { packageType, responsibleUserId }),
    onSuccess: invalidate,
  });
};

export const useAddPackageAsset = () => {
  const invalidate = useInvalidateOperational();
  return useMutation({
    mutationFn: ({
      packageId,
      assetInstanceId,
      assetTag,
    }: {
      packageId: string;
      assetInstanceId?: string;
      assetTag?: string;
    }) => post<PackageDto>(`/packages/${packageId}/assets`, { assetInstanceId, assetTag }),
    onSuccess: invalidate,
  });
};

export const useRemovePackageAsset = () => {
  const invalidate = useInvalidateOperational();
  return useMutation({
    mutationFn: ({ packageId, assetId }: { packageId: string; assetId: string }) =>
      remove<PackageDto>(`/packages/${packageId}/assets/${assetId}`),
    onSuccess: invalidate,
  });
};

export const useAddPackageBulkLine = () => {
  const invalidate = useInvalidateOperational();
  return useMutation({
    mutationFn: ({
      packageId,
      productCatalogItemId,
      quantity,
    }: {
      packageId: string;
      productCatalogItemId: string;
      quantity: number;
    }) => post<PackageDto>(`/packages/${packageId}/bulk-lines`, { productCatalogItemId, quantity }),
    onSuccess: invalidate,
  });
};

export const useUpdatePackageBulkLine = () => {
  const invalidate = useInvalidateOperational();
  return useMutation({
    mutationFn: ({
      packageId,
      lineId,
      quantity,
    }: {
      packageId: string;
      lineId: string;
      quantity: number;
    }) => patch<PackageDto>(`/packages/${packageId}/bulk-lines/${lineId}`, { quantity }),
    onSuccess: invalidate,
  });
};

export const useRemovePackageBulkLine = () => {
  const invalidate = useInvalidateOperational();
  return useMutation({
    mutationFn: ({ packageId, lineId }: { packageId: string; lineId: string }) =>
      remove<PackageDto>(`/packages/${packageId}/bulk-lines/${lineId}`),
    onSuccess: invalidate,
  });
};

export const useSealPackage = () => {
  const invalidate = useInvalidateOperational();
  return useMutation({
    mutationFn: (packageId: string) => post<PackageDto>(`/packages/${packageId}/seal`),
    onSuccess: invalidate,
  });
};

export const useReopenPackage = () => {
  const invalidate = useInvalidateOperational();
  return useMutation({
    mutationFn: ({ packageId, reason }: { packageId: string; reason?: string }) =>
      post<PackageDto>(`/packages/${packageId}/reopen`, { reason }),
    onSuccess: invalidate,
  });
};

export const useReceivePackage = () => {
  const invalidate = useInvalidateOperational();
  return useMutation({
    mutationFn: ({ packageId, idempotencyKey }: { packageId: string; idempotencyKey?: string }) =>
      post<PackageDto>(`/packages/${packageId}/receive`, { idempotencyKey }),
    onSuccess: invalidate,
  });
};

export const useDeliverPackage = () => {
  const invalidate = useInvalidateOperational();
  return useMutation({
    mutationFn: ({ packageId, idempotencyKey }: { packageId: string; idempotencyKey?: string }) =>
      post<PackageDto>(`/packages/${packageId}/deliver`, { idempotencyKey }),
    onSuccess: invalidate,
  });
};

// ==================== Missions ====================

export const useMissions = (params?: Params, enabled = true) =>
  useQuery({
    queryKey: queryKeys.missions(params),
    queryFn: () => get<PaginatedResult<MissionSummaryDto>>('/missions', params),
    enabled,
  });

export const useMission = (missionId?: string) =>
  useQuery({
    queryKey: queryKeys.mission(missionId ?? ''),
    queryFn: () => get<MissionDto>(`/missions/${missionId}`),
    enabled: Boolean(missionId),
  });

export const useRouteSuggestion = () =>
  useMutation({
    mutationFn: (packageIds: string[]) =>
      post<RouteSuggestionDto>('/missions/route-suggestions', { packageIds }),
  });

export const useCreateMission = () => {
  const invalidate = useInvalidateOperational();
  return useMutation({
    mutationFn: (input: CreateMissionInput) => post<MissionDto>('/missions', input),
    onSuccess: invalidate,
  });
};

export const useUpdateMission = () => {
  const invalidate = useInvalidateOperational();
  return useMutation({
    mutationFn: ({ missionId, input }: { missionId: string; input: UpdateMissionInput }) =>
      patch<MissionDto>(`/missions/${missionId}`, input),
    onSuccess: invalidate,
  });
};

export const useReorderStops = () => {
  const invalidate = useInvalidateOperational();
  return useMutation({
    mutationFn: ({ missionId, stopIds }: { missionId: string; stopIds: string[] }) =>
      patch<MissionDto>(`/missions/${missionId}/stops/reorder`, { stopIds }),
    onSuccess: invalidate,
  });
};

export const useRemoveMissionPackage = () => {
  const invalidate = useInvalidateOperational();
  return useMutation({
    mutationFn: ({ missionId, packageId }: { missionId: string; packageId: string }) =>
      remove<MissionDto>(`/missions/${missionId}/packages/${packageId}`),
    onSuccess: invalidate,
  });
};

export const useMissionAction = (action: string) => {
  const invalidate = useInvalidateOperational();
  return useMutation({
    mutationFn: (missionId: string) => post<MissionDto>(`/missions/${missionId}/${action}`),
    onSuccess: invalidate,
  });
};

export const useArriveAtStop = () => {
  const invalidate = useInvalidateOperational();
  return useMutation({
    mutationFn: ({ missionId, stopId }: { missionId: string; stopId: string }) =>
      post<MissionDto>(`/missions/${missionId}/stops/${stopId}/arrive`),
    onSuccess: invalidate,
  });
};

export const useLoadMissionPackage = () => {
  const invalidate = useInvalidateOperational();
  return useMutation({
    mutationFn: ({
      missionId,
      packageId,
      idempotencyKey,
    }: {
      missionId: string;
      packageId: string;
      idempotencyKey?: string;
    }) => post<MissionDto>(`/missions/${missionId}/packages/${packageId}/load`, { idempotencyKey }),
    onSuccess: invalidate,
  });
};

export const useUnloadMissionPackage = () => {
  const invalidate = useInvalidateOperational();
  return useMutation({
    mutationFn: ({
      missionId,
      packageId,
      idempotencyKey,
    }: {
      missionId: string;
      packageId: string;
      idempotencyKey?: string;
    }) =>
      post<MissionDto>(`/missions/${missionId}/packages/${packageId}/unload`, { idempotencyKey }),
    onSuccess: invalidate,
  });
};

// ==================== Join requests ====================

export const useJoinRequests = (params?: Params, enabled = true) =>
  useQuery({
    queryKey: queryKeys.joinRequests(params),
    queryFn: () => get<PaginatedResult<JoinRequestDto>>('/mission-join-requests', params),
    enabled,
  });

export const useCreateJoinRequest = () => {
  const invalidate = useInvalidateOperational();
  return useMutation({
    mutationFn: ({ missionId, input }: { missionId: string; input: CreateJoinRequestInput }) =>
      post<JoinRequestDto>(`/missions/${missionId}/join-requests`, input),
    onSuccess: invalidate,
  });
};

export const useReviewJoinRequest = (decision: 'approve' | 'reject') => {
  const invalidate = useInvalidateOperational();
  return useMutation({
    mutationFn: ({ requestId, note }: { requestId: string; note?: string }) =>
      post<JoinRequestDto>(`/mission-join-requests/${requestId}/${decision}`, { note }),
    onSuccess: invalidate,
  });
};
