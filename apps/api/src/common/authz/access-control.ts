import { UserRole } from '@south/shared';
import { AppException } from '../errors/app.exception';
import type { AuthenticatedUser } from '../../modules/auth/auth.types';

/**
 * NoCyberHere: AUTHORIZATION
 * Threat: IDOR / BOLA - שינוי מזהה ב-URL כדי לקבל אובייקט של משתמש או צוות אחר
 * Reason: כל גישה לאובייקט עוברת כאן. אימות (מי אתה) אינו הרשאה (מה מותר לך על האובייקט הזה).
 *
 * הפונקציות כאן טהורות ונבדקות ביחידה, כדי שכלל ההרשאה יהיה גלוי, ניתן לבדיקה ולביקורת.
 */

export interface PackageScope {
  teamId: string;
  sourceBaseId: string;
  destinationBaseId: string;
  taskAssignedSoldierId: string;
  missionAssignedSoldierId: string | null;
}

export interface TaskScope {
  teamId: string;
  assignedSoldierId: string;
  sourceBaseId: string;
}

export interface MissionScope {
  assignedSoldierId: string | null;
  createdById: string;
  stopBaseIds: string[];
}

export const isCommander = (user: AuthenticatedUser): boolean =>
  user.role === UserRole.LOGISTICS_COMMANDER;
export const isSoldier = (user: AuthenticatedUser): boolean =>
  user.role === UserRole.LOGISTICS_SOLDIER;
export const isTeamLead = (user: AuthenticatedUser): boolean => user.role === UserRole.TEAM_LEAD;
/**
 * מפקד מבצע - תפקיד מאקרו. רואה את כל המבצע, ואינו מבצע בו דבר.
 * הפעולה היחידה שלו במערכת היא אישור בקשת הצטרפות לשליחות.
 */
export const isOperationCommander = (user: AuthenticatedUser): boolean =>
  user.role === UserRole.OPERATION_COMMANDER;

/** מי שרשאי לצפות בכל המבצע ללא סינון: מפקד לוגיסטיקה ומפקד מבצע. */
const seesEverything = (user: AuthenticatedUser): boolean =>
  isCommander(user) || isOperationCommander(user);

/** האם המשתמש מוצב בקריית התקשוב (בסיס היעד). */
export function isHubUser(user: AuthenticatedUser, hubBaseId: string | null): boolean {
  return Boolean(hubBaseId && user.baseId === hubBaseId);
}

/** צפייה באריזה. */
export function canViewPackage(
  user: AuthenticatedUser,
  scope: PackageScope,
  hubBaseId: string | null,
): boolean {
  if (seesEverything(user)) return true;

  if (isTeamLead(user)) {
    // ראש צוות רואה רק אריזות של הצוותים שבתחום ההרשאה שלו.
    return user.teamIds.includes(scope.teamId);
  }

  if (isSoldier(user)) {
    if (scope.taskAssignedSoldierId === user.id) return true;
    if (scope.missionAssignedSoldierId === user.id) return true;
    if (user.baseId && user.baseId === scope.sourceBaseId) return true;
    // חייל בקריית התקשוב מטפל בקליטה ובפיזור של כל האריזות שמגיעות אליה.
    if (isHubUser(user, hubBaseId) && scope.destinationBaseId === hubBaseId) return true;
  }

  return false;
}

/** עריכת תכולת אריזה - רק החייל שהמשימה שויכה אליו, או מפקד לוגיסטיקה. */
export function canEditPackageContent(user: AuthenticatedUser, scope: PackageScope): boolean {
  // מפקד מבצע אינו נוגע בתכולה - הוא צופה בלבד.
  if (isOperationCommander(user)) return false;
  if (isCommander(user)) return true;
  return isSoldier(user) && scope.taskAssignedSoldierId === user.id;
}

/** קליטה ופיזור - החייל המבצע של השליחות, או חייל המוצב בקריית התקשוב. */
export function canHandleAtHub(
  user: AuthenticatedUser,
  scope: PackageScope,
  hubBaseId: string | null,
): boolean {
  // מפקד מבצע אינו קולט ואינו מפזר, גם כשהוא מוצב בקריית התקשוב.
  if (isOperationCommander(user)) return false;
  if (isCommander(user)) return true;
  if (!isSoldier(user)) return false;
  if (scope.missionAssignedSoldierId === user.id) return true;
  return isHubUser(user, hubBaseId);
}

export function canViewTask(user: AuthenticatedUser, scope: TaskScope): boolean {
  if (seesEverything(user)) return true;
  if (isTeamLead(user)) return user.teamIds.includes(scope.teamId);
  return isSoldier(user) && scope.assignedSoldierId === user.id;
}

/** ביצוע משימה - רק החייל ששויך אליה. */
export function canExecuteTask(user: AuthenticatedUser, scope: TaskScope): boolean {
  return isSoldier(user) && scope.assignedSoldierId === user.id;
}

export function canViewMission(
  user: AuthenticatedUser,
  scope: MissionScope,
  hubBaseId: string | null,
): boolean {
  if (seesEverything(user)) return true;
  if (!isSoldier(user)) return false;
  if (scope.assignedSoldierId === user.id) return true;
  // חייל רואה שליחויות שעוברות בבסיס שלו, כדי שיוכל לבקש הצטרפות.
  if (user.baseId && scope.stopBaseIds.includes(user.baseId)) return true;
  return isHubUser(user, hubBaseId);
}

/** ביצוע שליחות בשטח - רק החייל המבצע. */
export function canExecuteMission(user: AuthenticatedUser, scope: MissionScope): boolean {
  return isSoldier(user) && scope.assignedSoldierId === user.id;
}

/** הנחיות נסיעה מאובטחת מוצגות רק למפקד ולחייל המבצע. */
export function canViewSecuredTransportNotes(
  user: AuthenticatedUser,
  scope: MissionScope,
): boolean {
  if (seesEverything(user)) return true;
  return isSoldier(user) && scope.assignedSoldierId === user.id;
}

// ---------- assertions ----------

export function assertViewPackage(
  user: AuthenticatedUser,
  scope: PackageScope,
  hubBaseId: string | null,
): void {
  if (!canViewPackage(user, scope, hubBaseId)) throw new AppException('FORBIDDEN_PACKAGE_SCOPE');
}

export function assertEditPackageContent(user: AuthenticatedUser, scope: PackageScope): void {
  if (!canEditPackageContent(user, scope)) throw new AppException('FORBIDDEN_PACKAGE_SCOPE');
}

export function assertViewTask(user: AuthenticatedUser, scope: TaskScope): void {
  if (!canViewTask(user, scope)) throw new AppException('FORBIDDEN_TASK_SCOPE');
}

export function assertExecuteTask(user: AuthenticatedUser, scope: TaskScope): void {
  if (!canExecuteTask(user, scope)) throw new AppException('FORBIDDEN_TASK_SCOPE');
}

export function assertViewMission(
  user: AuthenticatedUser,
  scope: MissionScope,
  hubBaseId: string | null,
): void {
  if (!canViewMission(user, scope, hubBaseId)) throw new AppException('FORBIDDEN_MISSION_SCOPE');
}

export function assertExecuteMission(user: AuthenticatedUser, scope: MissionScope): void {
  if (!canExecuteMission(user, scope)) throw new AppException('FORBIDDEN_MISSION_SCOPE');
}
