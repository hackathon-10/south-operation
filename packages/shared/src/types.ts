import type {
  AssetStatus,
  DoorSide,
  JoinRequestStatus,
  MappingStatus,
  MissionStatus,
  PackageStatus,
  PackageType,
  PackingTaskStatus,
  RoomMapState,
  StopStatus,
  StopType,
  TaskPriority,
  TrackingMode,
  UserRole,
  VehicleType,
} from './enums';

/** ==================== Auth ==================== */

export interface AuthUserDto {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  baseId: string | null;
  baseName: string | null;
  teamId: string | null;
  teamName: string | null;
}

export interface LoginResponseDto {
  accessToken: string;
  expiresInSeconds: number;
  user: AuthUserDto;
}

export interface DemoUserDto {
  email: string;
  fullName: string;
  role: UserRole;
  description: string;
}

/** ==================== Reference data ==================== */

export interface BaseDto {
  id: string;
  code: string;
  name: string;
  addressText: string;
  latitude: number;
  longitude: number;
  isDestinationHub: boolean;
}

export interface OrganizationalUnitDto {
  id: string;
  name: string;
  code: string;
  baseId: string;
  parentId: string | null;
  type: string;
}

export interface TeamDto {
  id: string;
  name: string;
  code: string;
  unitId: string;
  unitName: string;
  baseId: string;
  leadUserId: string | null;
  leadUserName: string | null;
}

export interface RoomDto {
  id: string;
  baseId: string;
  baseName: string;
  unitId: string | null;
  teamId: string | null;
  teamName: string | null;
  building: string;
  floor: string;
  roomNumber: string;
  displayName: string;
  floorMapId: string | null;
  mappingStatus: MappingStatus;
  isActive: boolean;
}

export interface CatalogItemDto {
  id: string;
  sku: string;
  name: string;
  category: string;
  trackingMode: TrackingMode;
  unitOfMeasure: string;
  isActive: boolean;
}

export interface AssetDto {
  id: string;
  assetTag: string;
  productCatalogItemId: string;
  productName: string;
  sku: string;
  category: string;
  ownerName: string;
  ownerIdentityNumber: string | null;
  currentRoomId: string | null;
  currentRoomName: string | null;
  status: AssetStatus;
  reservedForTaskId: string | null;
}

export interface RoomInventoryLineDto {
  productCatalogItemId: string;
  sku: string;
  productName: string;
  category: string;
  unitOfMeasure: string;
  mappedQuantity: number;
  reservedQuantity: number;
  packedQuantity: number;
  deliveredQuantity: number;
  availableQuantity: number;
}

export interface RoomInventoryDto {
  room: RoomDto;
  bulkLines: RoomInventoryLineDto[];
  assets: AssetDto[];
  totals: {
    bulkUnits: number;
    assetUnits: number;
    totalUnits: number;
  };
}

/** ==================== Floor map ==================== */

export interface FloorMapSummaryDto {
  id: string;
  baseId: string;
  building: string;
  floorNumber: number;
  displayName: string;
  canvasWidth: number;
  canvasHeight: number;
  version: number;
}

export interface FloorMapRoomShapeDto {
  shapeId: string;
  roomId: string;
  roomNumber: string;
  displayName: string;
  teamId: string | null;
  teamName: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  doorSide: DoorSide;
  zone: string | null;
  /** סיכום שמוצג על החדר במפה. */
  totalUnits: number;
  assetCount: number;
  activeTaskCount: number;
  incomingPackageCount: number;
  arrivedPackageCount: number;
  state: RoomMapState;
}

export interface FloorMapDetailsDto {
  map: FloorMapSummaryDto;
  corridor: { x: number; y: number; width: number; height: number };
  rooms: FloorMapRoomShapeDto[];
}

export interface RoomMapSearchHitDto {
  roomId: string;
  roomNumber: string;
  displayName: string;
  floorNumber: number;
  floorMapId: string;
  matchedOn: 'ROOM' | 'TEAM' | 'OWNER' | 'ASSET_TAG' | 'SKU';
  matchedValue: string;
}

export interface RoomPanelDto {
  room: RoomDto;
  teamName: string | null;
  leadUserName: string | null;
  bulkLines: RoomInventoryLineDto[];
  assets: AssetDto[];
  activeTasks: PackingTaskSummaryDto[];
  incomingPackages: PackageSummaryDto[];
  arrivedPackages: PackageSummaryDto[];
  state: RoomMapState;
  totals: { bulkUnits: number; assetUnits: number; totalUnits: number };
}

/** ==================== Packing tasks ==================== */

export interface PackingTaskLineDto {
  id: string;
  productCatalogItemId: string;
  sku: string;
  productName: string;
  trackingMode: TrackingMode;
  assetInstanceId: string | null;
  assetTag: string | null;
  ownerName: string | null;
  requestedQuantity: number;
  packedQuantity: number;
  remainingQuantity: number;
}

export interface PackingTaskProgressDto {
  totalUnits: number;
  packedUnits: number;
  percent: number;
  packageCount: number;
}

export interface PackingTaskSummaryDto {
  id: string;
  taskNumber: string;
  status: PackingTaskStatus;
  priority: TaskPriority;
  sourceRoomName: string;
  sourceBaseName: string;
  destinationRoomName: string;
  teamName: string;
  assignedSoldierName: string;
  dueAt: string | null;
  createdAt: string;
  progress: PackingTaskProgressDto;
}

export interface PackingTaskDto extends PackingTaskSummaryDto {
  sourceRoomId: string;
  sourceBaseId: string;
  destinationRoomId: string;
  destinationRoomDetails: { building: string; floor: string; roomNumber: string };
  teamId: string;
  assignedSoldierId: string;
  createdById: string;
  createdByName: string;
  notes: string | null;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
  lines: PackingTaskLineDto[];
  packages: PackageSummaryDto[];
}

/** ==================== Packages ==================== */

export interface PackageAssetDto {
  id: string;
  assetInstanceId: string;
  assetTag: string;
  productName: string;
  sku: string;
  ownerName: string;
  ownerIdentityNumber: string | null;
}

export interface PackageBulkLineDto {
  id: string;
  productCatalogItemId: string;
  sku: string;
  productName: string;
  unitOfMeasure: string;
  quantity: number;
}

export interface PackageStatusEventDto {
  id: string;
  fromStatus: PackageStatus | null;
  toStatus: PackageStatus;
  actorUserId: string;
  actorName: string;
  missionId: string | null;
  missionNumber: string | null;
  note: string | null;
  createdAt: string;
}

export interface PackageSummaryDto {
  id: string;
  packageNumber: string;
  status: PackageStatus;
  packageType: PackageType;
  sourceBaseName: string;
  sourceRoomName: string;
  destinationRoomName: string;
  destination: { building: string; floor: string; roomNumber: string };
  teamId: string;
  teamName: string;
  itemLineCount: number;
  totalUnits: number;
  missionId: string | null;
  missionNumber: string | null;
  sealedAt: string | null;
  createdAt: string;
  priority: TaskPriority;
}

export interface PackageDto extends PackageSummaryDto {
  packingTaskId: string;
  taskNumber: string;
  sourceBaseId: string;
  sourceRoomId: string;
  destinationRoomId: string;
  notes: string | null;
  createdById: string;
  createdByName: string;
  departedAt: string | null;
  receivedAt: string | null;
  deliveredAt: string | null;
  updatedAt: string;
  isLocked: boolean;
  assets: PackageAssetDto[];
  bulkLines: PackageBulkLineDto[];
  timeline: PackageStatusEventDto[];
  /** מה מותר למשתמש הנוכחי לעשות עם האריזה - מחושב בשרת. */
  permissions: {
    canEditContent: boolean;
    canSeal: boolean;
    canReopen: boolean;
    canReceive: boolean;
    canDeliver: boolean;
    canPrintLabel: boolean;
  };
}

export interface PackageLabelDto {
  packageNumber: string;
  qrUrl: string;
  sourceBaseName: string;
  sourceRoomName: string;
  teamName: string;
  destination: { building: string; floor: string; roomNumber: string; displayName: string };
  lineCount: number;
  totalUnits: number;
  sealedAt: string | null;
  printedAt: string;
}

/** התשובה למסך הסריקה: מה לעשות עכשיו עם האריזה. */
export interface PackageScanResultDto {
  package: PackageDto;
  /** הפעולה המומלצת לפי הסטטוס והתפקיד. */
  suggestedAction:
    | 'LOAD'
    | 'RECEIVE'
    | 'DELIVER'
    | 'VIEW_ONLY'
    | 'CONTINUE_PACKING'
    | 'NOTHING_TO_DO';
  suggestedActionLabel: string;
  missionId: string | null;
}

/** ==================== Missions ==================== */

export interface MissionStopDto {
  id: string;
  baseId: string;
  baseName: string;
  baseCode: string;
  sequence: number;
  stopType: StopType;
  status: StopStatus;
  plannedAt: string | null;
  arrivedAt: string | null;
  completedAt: string | null;
  packages: MissionPackageDto[];
  plannedPackageCount: number;
  loadedPackageCount: number;
}

export interface MissionPackageDto {
  packageId: string;
  packageNumber: string;
  status: PackageStatus;
  teamName: string;
  sourceRoomName: string;
  destinationRoomName: string;
  totalUnits: number;
  pickupStopId: string;
  loadedAt: string | null;
  unloadedAt: string | null;
}

export interface RouteLegDto {
  fromBaseName: string;
  toBaseName: string;
  distanceKm: number;
  durationMinutes: number;
}

export interface RouteSuggestionDto {
  /** סדר הבסיסים המוצע, כולל נקודת ההתחלה והסיום בקריית התקשוב. */
  stops: Array<{
    baseId: string;
    baseCode: string;
    baseName: string;
    stopType: StopType;
    sequence: number;
    packageCount: number;
    highestPriority: TaskPriority | null;
    longestWaitHours: number;
  }>;
  legs: RouteLegDto[];
  totalDistanceKm: number;
  totalDurationMinutes: number;
  optimizationScore: number;
  /** הסבר קריא למפקד - למה זה המסלול המוצע (§9). */
  explanation: string[];
  estimatedTripsSaved: number;
}

export interface MissionSummaryDto {
  id: string;
  missionNumber: string;
  title: string;
  status: MissionStatus;
  plannedDepartureAt: string;
  actualDepartureAt: string | null;
  completedAt: string | null;
  assignedSoldierId: string | null;
  assignedSoldierName: string | null;
  vehicleType: VehicleType;
  requiresSecuredTransport: boolean;
  stopCount: number;
  packageCount: number;
  loadedPackageCount: number;
  routeDistanceKmEstimate: number | null;
  routeDurationMinutesEstimate: number | null;
  pickupBaseNames: string[];
}

export interface MissionDto extends MissionSummaryDto {
  createdById: string;
  createdByName: string;
  vehicleDetails: string | null;
  licensePlate: string | null;
  /** מוצג רק למשתמשים מורשים; אחרת null. */
  securedTransportNotes: string | null;
  optimizationScore: number | null;
  createdAt: string;
  updatedAt: string;
  stops: MissionStopDto[];
  packages: MissionPackageDto[];
  routeExplanation: string[];
  pendingJoinRequestCount: number;
  permissions: {
    canEdit: boolean;
    canManagePackages: boolean;
    canStartLoading: boolean;
    canDepart: boolean;
    canUnload: boolean;
    canComplete: boolean;
    canCancel: boolean;
    canRequestJoin: boolean;
  };
}

export interface JoinRequestDto {
  id: string;
  transportMissionId: string;
  missionNumber: string;
  missionTitle: string;
  requestingUserId: string;
  requestingUserName: string;
  baseId: string;
  baseName: string;
  status: JoinRequestStatus;
  note: string | null;
  packages: Array<{
    packageId: string;
    packageNumber: string;
    status: PackageStatus;
    totalUnits: number;
    teamName: string;
  }>;
  reviewedById: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

/** ==================== Dashboards ==================== */

export interface StatusCountDto {
  status: string;
  label: string;
  count: number;
}

export interface BaseProgressDto {
  baseId: string;
  baseCode: string;
  baseName: string;
  totalPackages: number;
  deliveredPackages: number;
  inTransitPackages: number;
  readyPackages: number;
  openTasks: number;
  percentDelivered: number;
}

export interface CommanderDashboardDto {
  tasks: {
    assigned: number;
    inProgress: number;
    completed: number;
    cancelled: number;
    completionPercent: number;
    urgentOpen: number;
  };
  packages: {
    byStatus: StatusCountDto[];
    total: number;
    inTransit: number;
    readyWaiting: number;
  };
  missions: {
    planned: number;
    loading: number;
    inTransit: number;
    unloading: number;
    completed: number;
  };
  overallProgressPercent: number;
  equipmentPackedPercent: number;
  averageTaskToSealMinutes: number | null;
  averageReadyToDepartMinutes: number | null;
  estimatedTripsSaved: number;
  baseProgress: BaseProgressDto[];
  urgentTasks: PackingTaskSummaryDto[];
  pendingJoinRequests: JoinRequestDto[];
  nextMission: MissionSummaryDto | null;
}

export interface SoldierDashboardDto {
  nextTask: PackingTaskSummaryDto | null;
  activeTasks: PackingTaskSummaryDto[];
  completedTodayCount: number;
  openPackages: PackageSummaryDto[];
  readyPackages: number;
  myMissions: MissionSummaryDto[];
  joinableMissions: MissionSummaryDto[];
  pendingJoinRequests: JoinRequestDto[];
}

export interface TeamLeadDashboardDto {
  teamNames: string[];
  packagesByStatus: StatusCountDto[];
  totalPackages: number;
  deliveredPackages: number;
  inTransitPackages: number;
  assetsCount: number;
  recentPackages: PackageSummaryDto[];
  progressPercent: number;
}

/** ==================== Audit ==================== */

export interface AuditLogDto {
  id: string;
  actorUserId: string | null;
  actorName: string | null;
  action: string;
  actionLabel: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface HealthDto {
  status: 'ok' | 'degraded';
  uptimeSeconds: number;
  database: 'up' | 'down';
  timestamp: string;
  version: string;
}
