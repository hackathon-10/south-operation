import {
  JOIN_REQUEST_STATUS_LABEL,
  JoinRequestStatus,
  MISSION_STATUS_LABEL,
  MissionStatus,
  PACKAGE_STATUS_LABEL,
  PackageStatus,
  ROOM_MAP_STATE_LABEL,
  RoomMapState,
  TASK_PRIORITY_LABEL,
  TASK_STATUS_LABEL,
  TaskPriority,
  PackingTaskStatus,
} from '@south/shared';
import type { ToneName } from '../theme/tokens';

/**
 * מיפוי סטטוס לצבע ולתווית.
 * הצבע לעולם אינו לבדו - התווית הטקסטואלית מוצגת תמיד לצידו (§10.1).
 */

export const packageTone: Record<PackageStatus, ToneName> = {
  OPEN: 'slate',
  SEALED: 'primary',
  READY_FOR_SHIPMENT: 'primary',
  ASSIGNED_TO_MISSION: 'violet',
  IN_TRANSIT: 'info',
  RECEIVED_AT_HUB: 'warning',
  DELIVERED_TO_ROOM: 'success',
};

export const taskTone: Record<PackingTaskStatus, ToneName> = {
  ASSIGNED: 'slate',
  IN_PROGRESS: 'info',
  COMPLETED: 'success',
  CANCELLED: 'danger',
};

export const priorityTone: Record<TaskPriority, ToneName> = {
  LOW: 'slate',
  NORMAL: 'primary',
  HIGH: 'warning',
  URGENT: 'danger',
};

export const missionTone: Record<MissionStatus, ToneName> = {
  DRAFT: 'slate',
  PLANNED: 'warning',
  LOADING: 'info',
  IN_TRANSIT: 'info',
  UNLOADING: 'violet',
  COMPLETED: 'success',
  CANCELLED: 'danger',
};

export const joinRequestTone: Record<JoinRequestStatus, ToneName> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
};

export const roomStateTone: Record<RoomMapState, ToneName> = {
  EMPTY: 'slate',
  HAS_EQUIPMENT: 'primary',
  PACKING_IN_PROGRESS: 'warning',
  IN_TRANSIT: 'info',
  ARRIVED: 'success',
};

export const labels = {
  package: PACKAGE_STATUS_LABEL,
  task: TASK_STATUS_LABEL,
  priority: TASK_PRIORITY_LABEL,
  mission: MISSION_STATUS_LABEL,
  joinRequest: JOIN_REQUEST_STATUS_LABEL,
  roomState: ROOM_MAP_STATE_LABEL,
};

/** התקדמות האריזה לאורך השרשרת, לצורך טבעת ההתקדמות בכרטיס. */
export const PACKAGE_PROGRESS: Record<PackageStatus, number> = {
  OPEN: 10,
  SEALED: 35,
  READY_FOR_SHIPMENT: 45,
  ASSIGNED_TO_MISSION: 60,
  IN_TRANSIT: 75,
  RECEIVED_AT_HUB: 90,
  DELIVERED_TO_ROOM: 100,
};

export const MISSION_PROGRESS: Record<MissionStatus, number> = {
  DRAFT: 5,
  PLANNED: 20,
  LOADING: 45,
  IN_TRANSIT: 70,
  UNLOADING: 88,
  COMPLETED: 100,
  CANCELLED: 0,
};
