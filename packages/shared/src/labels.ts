import {
  AssetStatus,
  JoinRequestStatus,
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

/**
 * תוויות בעברית לכל ערך Enum.
 * הממשק לעולם לא מציג למשתמש את ערך ה-Enum הגולמי.
 */
export const USER_ROLE_LABEL: Record<UserRole, string> = {
  LOGISTICS_COMMANDER: 'מפקד לוגיסטיקה',
  OPERATION_COMMANDER: 'מפקד מבצע',
  LOGISTICS_SOLDIER: 'חייל לוגיסטיקה',
  TEAM_LEAD: 'ראש צוות',
};

export const TASK_STATUS_LABEL: Record<PackingTaskStatus, string> = {
  ASSIGNED: 'משויכת',
  IN_PROGRESS: 'בביצוע',
  COMPLETED: 'הושלמה',
  CANCELLED: 'בוטלה',
};

export const TASK_PRIORITY_LABEL: Record<TaskPriority, string> = {
  LOW: 'נמוכה',
  NORMAL: 'רגילה',
  HIGH: 'גבוהה',
  URGENT: 'דחופה',
};

export const PACKAGE_STATUS_LABEL: Record<PackageStatus, string> = {
  OPEN: 'פתוחה',
  SEALED: 'סגורה',
  READY_FOR_SHIPMENT: 'מוכנה לשילוח',
  ASSIGNED_TO_MISSION: 'משויכת לשליחות',
  IN_TRANSIT: 'בדרך',
  RECEIVED_AT_HUB: 'נקלטה בקריית התקשוב',
  DELIVERED_TO_ROOM: 'הגיעה לחדר היעד',
};

export const PACKAGE_TYPE_LABEL: Record<PackageType, string> = {
  PROFESSIONAL_BOX: 'ארגז מקצועי',
  PERSONAL_BOX: 'ארגז אישי',
  PALLET: 'משטח',
  CRATE: 'ארגז עץ',
  BULK_CONTAINER: 'מכולת ציוד',
};

export const MISSION_STATUS_LABEL: Record<MissionStatus, string> = {
  DRAFT: 'טיוטה',
  PLANNED: 'מתוכננת',
  LOADING: 'בהעמסה',
  IN_TRANSIT: 'בדרך',
  UNLOADING: 'בפריקה',
  COMPLETED: 'הושלמה',
  CANCELLED: 'בוטלה',
};

export const STOP_TYPE_LABEL: Record<StopType, string> = {
  START: 'נקודת יציאה',
  PICKUP: 'איסוף',
  DELIVERY_HUB: 'פריקה בקריית התקשוב',
  END: 'סיום',
};

export const STOP_STATUS_LABEL: Record<StopStatus, string> = {
  PLANNED: 'מתוכננת',
  ARRIVED: 'הגיע',
  COMPLETED: 'הושלמה',
};

export const JOIN_REQUEST_STATUS_LABEL: Record<JoinRequestStatus, string> = {
  PENDING: 'ממתינה לאישור',
  APPROVED: 'אושרה',
  REJECTED: 'נדחתה',
};

export const ASSET_STATUS_LABEL: Record<AssetStatus, string> = {
  AVAILABLE: 'זמין',
  RESERVED_FOR_TASK: 'משוריין למשימה',
  PACKED: 'ארוז',
  IN_TRANSIT: 'בדרך',
  RECEIVED: 'נקלט',
  DELIVERED: 'הגיע לחדר',
};

export const TRACKING_MODE_LABEL: Record<TrackingMode, string> = {
  SERIALIZED: 'פריט ייחודי',
  BULK: 'ציוד כמותי',
};

export const VEHICLE_TYPE_LABEL: Record<VehicleType, string> = {
  TRUCK: 'משאית',
  OTHER: 'אחר',
};

export const ROOM_MAP_STATE_LABEL: Record<RoomMapState, string> = {
  EMPTY: 'ללא ציוד',
  HAS_EQUIPMENT: 'יש ציוד',
  PACKING_IN_PROGRESS: 'בתהליך אריזה',
  IN_TRANSIT: 'ציוד בדרך',
  ARRIVED: 'ציוד הגיע',
};
