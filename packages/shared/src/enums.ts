/**
 * ערכי ה-Enums של המערכת.
 * מקור האמת הוא סכמת Prisma; הקבועים כאן חייבים להיות זהים לה בדיוק.
 * שימוש בקבועים במקום מחרוזות חופשיות (דרישת §22 במסמך האפיון).
 */

export const UserRole = {
  LOGISTICS_COMMANDER: 'LOGISTICS_COMMANDER',
  LOGISTICS_SOLDIER: 'LOGISTICS_SOLDIER',
  TEAM_LEAD: 'TEAM_LEAD',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];
export const USER_ROLES = Object.values(UserRole);

export const UnitType = {
  UNIT: 'UNIT',
  BRANCH: 'BRANCH',
  SECTION: 'SECTION',
} as const;
export type UnitType = (typeof UnitType)[keyof typeof UnitType];

export const MappingStatus = {
  MAPPED: 'MAPPED',
  NOT_MAPPED: 'NOT_MAPPED',
} as const;
export type MappingStatus = (typeof MappingStatus)[keyof typeof MappingStatus];

export const DoorSide = {
  NORTH: 'NORTH',
  SOUTH: 'SOUTH',
  EAST: 'EAST',
  WEST: 'WEST',
} as const;
export type DoorSide = (typeof DoorSide)[keyof typeof DoorSide];

export const TrackingMode = {
  SERIALIZED: 'SERIALIZED',
  BULK: 'BULK',
} as const;
export type TrackingMode = (typeof TrackingMode)[keyof typeof TrackingMode];

export const AssetStatus = {
  AVAILABLE: 'AVAILABLE',
  RESERVED_FOR_TASK: 'RESERVED_FOR_TASK',
  PACKED: 'PACKED',
  IN_TRANSIT: 'IN_TRANSIT',
  RECEIVED: 'RECEIVED',
  DELIVERED: 'DELIVERED',
} as const;
export type AssetStatus = (typeof AssetStatus)[keyof typeof AssetStatus];

export const TaskPriority = {
  LOW: 'LOW',
  NORMAL: 'NORMAL',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
} as const;
export type TaskPriority = (typeof TaskPriority)[keyof typeof TaskPriority];
export const TASK_PRIORITIES = Object.values(TaskPriority);

/** משקל הדחיפות לצורך דירוג עצירות באלגוריתם המסלול. */
export const TASK_PRIORITY_WEIGHT: Record<TaskPriority, number> = {
  LOW: 1,
  NORMAL: 2,
  HIGH: 4,
  URGENT: 8,
};

export const PackingTaskStatus = {
  ASSIGNED: 'ASSIGNED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;
export type PackingTaskStatus = (typeof PackingTaskStatus)[keyof typeof PackingTaskStatus];

export const PackageType = {
  PROFESSIONAL_BOX: 'PROFESSIONAL_BOX',
  PERSONAL_BOX: 'PERSONAL_BOX',
  PALLET: 'PALLET',
  CRATE: 'CRATE',
  BULK_CONTAINER: 'BULK_CONTAINER',
} as const;
export type PackageType = (typeof PackageType)[keyof typeof PackageType];
export const PACKAGE_TYPES = Object.values(PackageType);

export const PackageStatus = {
  OPEN: 'OPEN',
  SEALED: 'SEALED',
  READY_FOR_SHIPMENT: 'READY_FOR_SHIPMENT',
  ASSIGNED_TO_MISSION: 'ASSIGNED_TO_MISSION',
  IN_TRANSIT: 'IN_TRANSIT',
  RECEIVED_AT_HUB: 'RECEIVED_AT_HUB',
  DELIVERED_TO_ROOM: 'DELIVERED_TO_ROOM',
} as const;
export type PackageStatus = (typeof PackageStatus)[keyof typeof PackageStatus];
export const PACKAGE_STATUSES = Object.values(PackageStatus);

export const VehicleType = {
  TRUCK: 'TRUCK',
  OTHER: 'OTHER',
} as const;
export type VehicleType = (typeof VehicleType)[keyof typeof VehicleType];

export const MissionStatus = {
  DRAFT: 'DRAFT',
  PLANNED: 'PLANNED',
  LOADING: 'LOADING',
  IN_TRANSIT: 'IN_TRANSIT',
  UNLOADING: 'UNLOADING',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;
export type MissionStatus = (typeof MissionStatus)[keyof typeof MissionStatus];
export const MISSION_STATUSES = Object.values(MissionStatus);

export const StopType = {
  START: 'START',
  PICKUP: 'PICKUP',
  DELIVERY_HUB: 'DELIVERY_HUB',
  END: 'END',
} as const;
export type StopType = (typeof StopType)[keyof typeof StopType];

export const StopStatus = {
  PLANNED: 'PLANNED',
  ARRIVED: 'ARRIVED',
  COMPLETED: 'COMPLETED',
} as const;
export type StopStatus = (typeof StopStatus)[keyof typeof StopStatus];

export const JoinRequestStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;
export type JoinRequestStatus = (typeof JoinRequestStatus)[keyof typeof JoinRequestStatus];

/** מצב תצוגה של חדר במפה האינטראקטיבית (מחושב בשרת, לא נשמר). */
export const RoomMapState = {
  EMPTY: 'EMPTY',
  HAS_EQUIPMENT: 'HAS_EQUIPMENT',
  PACKING_IN_PROGRESS: 'PACKING_IN_PROGRESS',
  IN_TRANSIT: 'IN_TRANSIT',
  ARRIVED: 'ARRIVED',
} as const;
export type RoomMapState = (typeof RoomMapState)[keyof typeof RoomMapState];
