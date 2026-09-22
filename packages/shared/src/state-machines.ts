import {
  JoinRequestStatus,
  MissionStatus,
  PackageStatus,
  PackingTaskStatus,
} from './enums';

/**
 * מכונות המצבים של המערכת (§8.12).
 *
 * ההגדרות נמצאות ב-shared כדי שיהיה מקור אמת יחיד:
 * שירותי ה-Domain בשרת אוכפים אותן, והממשק משתמש בהן רק כדי להציג/להסתיר פעולות.
 * האכיפה עצמה היא תמיד בשרת.
 */

export const PACKAGE_TRANSITIONS: Record<PackageStatus, PackageStatus[]> = {
  OPEN: [PackageStatus.SEALED],
  SEALED: [PackageStatus.READY_FOR_SHIPMENT, PackageStatus.OPEN],
  READY_FOR_SHIPMENT: [PackageStatus.ASSIGNED_TO_MISSION, PackageStatus.OPEN],
  // חזרה ל-OPEN מותרת רק אחרי הסרת האריזה משליחות שטרם יצאה (§8.12).
  // READY_FOR_SHIPMENT הוא ביטול השיבוץ בלבד: האריזה נשארת סגורה ומאומתת
  // וחוזרת לבריכת האריזות המוכנות. מתועד ב-docs/architecture.md.
  ASSIGNED_TO_MISSION: [
    PackageStatus.IN_TRANSIT,
    PackageStatus.OPEN,
    PackageStatus.READY_FOR_SHIPMENT,
  ],
  IN_TRANSIT: [PackageStatus.RECEIVED_AT_HUB],
  RECEIVED_AT_HUB: [PackageStatus.DELIVERED_TO_ROOM],
  DELIVERED_TO_ROOM: [],
};

export const PACKING_TASK_TRANSITIONS: Record<PackingTaskStatus, PackingTaskStatus[]> = {
  ASSIGNED: [PackingTaskStatus.IN_PROGRESS, PackingTaskStatus.CANCELLED],
  IN_PROGRESS: [PackingTaskStatus.COMPLETED, PackingTaskStatus.CANCELLED],
  COMPLETED: [],
  CANCELLED: [],
};

export const MISSION_TRANSITIONS: Record<MissionStatus, MissionStatus[]> = {
  DRAFT: [MissionStatus.PLANNED, MissionStatus.CANCELLED],
  PLANNED: [MissionStatus.LOADING, MissionStatus.CANCELLED],
  LOADING: [MissionStatus.IN_TRANSIT],
  IN_TRANSIT: [MissionStatus.UNLOADING],
  UNLOADING: [MissionStatus.COMPLETED],
  COMPLETED: [],
  CANCELLED: [],
};

export const JOIN_REQUEST_TRANSITIONS: Record<JoinRequestStatus, JoinRequestStatus[]> = {
  PENDING: [JoinRequestStatus.APPROVED, JoinRequestStatus.REJECTED],
  APPROVED: [],
  REJECTED: [],
};

export function canTransitionPackage(from: PackageStatus, to: PackageStatus): boolean {
  return PACKAGE_TRANSITIONS[from]?.includes(to) ?? false;
}

export function canTransitionTask(from: PackingTaskStatus, to: PackingTaskStatus): boolean {
  return PACKING_TASK_TRANSITIONS[from]?.includes(to) ?? false;
}

export function canTransitionMission(from: MissionStatus, to: MissionStatus): boolean {
  return MISSION_TRANSITIONS[from]?.includes(to) ?? false;
}

export function canTransitionJoinRequest(
  from: JoinRequestStatus,
  to: JoinRequestStatus,
): boolean {
  return JOIN_REQUEST_TRANSITIONS[from]?.includes(to) ?? false;
}

/** אריזה ננעלת מרגע שהשליחות יצאה לדרך (§7.10). */
export const LOCKED_PACKAGE_STATUSES: PackageStatus[] = [
  PackageStatus.IN_TRANSIT,
  PackageStatus.RECEIVED_AT_HUB,
  PackageStatus.DELIVERED_TO_ROOM,
];

export function isPackageLocked(status: PackageStatus): boolean {
  return LOCKED_PACKAGE_STATUSES.includes(status);
}

/** תכולת אריזה ניתנת לעריכה רק כשהיא פתוחה ולא נעולה. */
export function isPackageContentEditable(status: PackageStatus): boolean {
  return status === PackageStatus.OPEN;
}

/** שליחות ניתנת לעריכה (מסלול, עצירות, אריזות) רק לפני היציאה. */
export function isMissionEditable(status: MissionStatus): boolean {
  return status === MissionStatus.DRAFT || status === MissionStatus.PLANNED;
}

/** אריזות של שליחות מתוכננת ניתנות עדיין לשחרור. */
export function isMissionBeforeDeparture(status: MissionStatus): boolean {
  return (
    status === MissionStatus.DRAFT ||
    status === MissionStatus.PLANNED ||
    status === MissionStatus.LOADING
  );
}

/** אריזות שמותר לשבץ לשליחות. */
export function isPackageAssignable(status: PackageStatus): boolean {
  return status === PackageStatus.READY_FOR_SHIPMENT;
}
