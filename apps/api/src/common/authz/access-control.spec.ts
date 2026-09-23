import { UserRole } from '@south/shared';
import type { AuthenticatedUser } from '../../modules/auth/auth.types';
import { AppException } from '../errors/app.exception';
import {
  PackageScope,
  assertViewPackage,
  canEditPackageContent,
  canExecuteMission,
  canExecuteTask,
  canHandleAtHub,
  canViewMission,
  canViewPackage,
  canViewSecuredTransportNotes,
  canViewTask,
  isOperationManager,
} from './access-control';

const HUB = 'base-hub';
const GDN = 'base-gdn';

const commander: AuthenticatedUser = {
  id: 'commander-1',
  email: 'c@demo',
  fullName: 'מפקדת',
  role: UserRole.LOGISTICS_COMMANDER,
  baseId: HUB,
  teamId: null,
  teamIds: [],
};

const soldierGdn: AuthenticatedUser = {
  id: 'soldier-gdn',
  email: 's@demo',
  fullName: 'חיילת',
  role: UserRole.LOGISTICS_SOLDIER,
  baseId: GDN,
  teamId: 'team-log',
  teamIds: ['team-log'],
};

const soldierHub: AuthenticatedUser = {
  ...soldierGdn,
  id: 'soldier-hub',
  baseId: HUB,
};

const otherSoldier: AuthenticatedUser = {
  ...soldierGdn,
  id: 'soldier-other',
  baseId: 'base-other',
};

const teamLead: AuthenticatedUser = {
  id: 'lead-1',
  email: 'l@demo',
  fullName: 'ראש צוות',
  role: UserRole.TEAM_LEAD,
  baseId: GDN,
  teamId: 'team-dev',
  teamIds: ['team-dev'],
};

const operationManager: AuthenticatedUser = {
  id: 'op-commander-1',
  email: 'op@demo',
  fullName: 'מפקד מבצע',
  role: UserRole.OPERATION_MANAGER,
  baseId: HUB,
  teamId: null,
  teamIds: [],
};

const scope: PackageScope = {
  teamId: 'team-dev',
  sourceBaseId: GDN,
  destinationBaseId: HUB,
  taskAssignedSoldierId: 'soldier-gdn',
  missionAssignedSoldierId: null,
};

describe('בקרת גישה לאריזות', () => {
  it('מפקד רואה כל אריזה', () => {
    expect(canViewPackage(commander, scope, HUB)).toBe(true);
  });

  it('ראש צוות רואה רק אריזות של הצוותים שלו', () => {
    expect(canViewPackage(teamLead, scope, HUB)).toBe(true);
    expect(canViewPackage(teamLead, { ...scope, teamId: 'team-אחר' }, HUB)).toBe(false);
  });

  it('חייל רואה אריזה של המשימה שלו או של הבסיס שלו', () => {
    expect(canViewPackage(soldierGdn, scope, HUB)).toBe(true);
    expect(
      canViewPackage(otherSoldier, { ...scope, taskAssignedSoldierId: 'someone-else' }, HUB),
    ).toBe(false);
  });

  it('חייל בקריית התקשוב רואה אריזות שמיועדות אליה', () => {
    expect(
      canViewPackage(soldierHub, { ...scope, taskAssignedSoldierId: 'someone-else' }, HUB),
    ).toBe(true);
  });

  it('שינוי מזהה בכתובת לא נותן גישה לאריזה של צוות אחר (IDOR)', () => {
    expect(() =>
      assertViewPackage(teamLead, { ...scope, teamId: 'team-זר' }, HUB),
    ).toThrow(AppException);
  });

  it('ראש צוות לעולם אינו רשאי לערוך תכולה', () => {
    expect(canEditPackageContent(teamLead, scope)).toBe(false);
  });

  it('רק החייל שהמשימה שויכה אליו יכול לערוך תכולה', () => {
    expect(canEditPackageContent(soldierGdn, scope)).toBe(true);
    expect(canEditPackageContent(otherSoldier, scope)).toBe(false);
    expect(canEditPackageContent(commander, scope)).toBe(true);
  });

  it('קליטה ופיזור מותרות לחייל המבצע או לחייל בקריית התקשוב', () => {
    expect(canHandleAtHub(soldierHub, scope, HUB)).toBe(true);
    expect(canHandleAtHub(otherSoldier, scope, HUB)).toBe(false);
    expect(
      canHandleAtHub(otherSoldier, { ...scope, missionAssignedSoldierId: otherSoldier.id }, HUB),
    ).toBe(true);
    expect(canHandleAtHub(teamLead, scope, HUB)).toBe(false);
  });
});

describe('בקרת גישה למשימות', () => {
  const taskScope = { teamId: 'team-dev', assignedSoldierId: 'soldier-gdn', sourceBaseId: GDN };

  it('חייל רואה רק משימות שלו', () => {
    expect(canViewTask(soldierGdn, taskScope)).toBe(true);
    expect(canViewTask(otherSoldier, taskScope)).toBe(false);
  });

  it('ראש צוות רואה משימות של הצוות שלו אך אינו מבצע אותן', () => {
    expect(canViewTask(teamLead, taskScope)).toBe(true);
    expect(canExecuteTask(teamLead, taskScope)).toBe(false);
  });

  it('מפקד רואה הכול אך אינו "מבצע" משימה בשטח', () => {
    expect(canViewTask(commander, taskScope)).toBe(true);
    expect(canExecuteTask(commander, taskScope)).toBe(false);
  });
});

describe('בקרת גישה לשליחויות', () => {
  const missionScope = {
    assignedSoldierId: 'soldier-gdn',
    createdById: commander.id,
    stopBaseIds: [HUB, GDN],
  };

  it('חייל רואה שליחות שעוברת בבסיס שלו', () => {
    expect(canViewMission(soldierGdn, missionScope, HUB)).toBe(true);
    expect(
      canViewMission(otherSoldier, { ...missionScope, assignedSoldierId: 'x' }, HUB),
    ).toBe(false);
  });

  it('רק החייל המבצע מבצע פעולות שטח', () => {
    expect(canExecuteMission(soldierGdn, missionScope)).toBe(true);
    expect(canExecuteMission(otherSoldier, missionScope)).toBe(false);
  });

  it('הנחיות נסיעה מאובטחת מוצגות רק למפקד ולחייל המבצע', () => {
    expect(canViewSecuredTransportNotes(commander, missionScope)).toBe(true);
    expect(canViewSecuredTransportNotes(soldierGdn, missionScope)).toBe(true);
    expect(canViewSecuredTransportNotes(otherSoldier, missionScope)).toBe(false);
    expect(canViewSecuredTransportNotes(teamLead, missionScope)).toBe(false);
  });

  it('ראש צוות אינו רואה שליחויות כלל', () => {
    expect(canViewMission(teamLead, missionScope, HUB)).toBe(false);
  });
});

/**
 * מפקד המבצע הוא תפקיד מאקרו: רואה הכול, אינו נוגע בכלום.
 *
 * הבדיקות כאן אינן "עוד מקרה" - הן הרשת שמונעת את התקלה השקטה שבה תפקיד חדש
 * נופל דרך ברירת המחדל של כל פונקציית הרשאה ומקבל אפס גישה, או גרוע מכך,
 * מקבל גישת כתיבה שלא התכוונו לתת לו.
 */
describe('בקרת גישה למפקד מבצע', () => {
  const taskScope = { teamId: 'team-dev', assignedSoldierId: 'soldier-gdn', sourceBaseId: GDN };
  const missionScope = {
    assignedSoldierId: 'soldier-gdn',
    createdById: commander.id,
    stopBaseIds: [HUB, GDN],
  };

  it('מזוהה כמפקד מבצע ואינו מזוהה כמפקד לוגיסטיקה', () => {
    expect(isOperationManager(operationManager)).toBe(true);
    expect(isOperationManager(commander)).toBe(false);
  });

  it('רואה כל אריזה, בכל בסיס ובכל צוות', () => {
    expect(canViewPackage(operationManager, scope, HUB)).toBe(true);
    expect(canViewPackage(operationManager, { ...scope, teamId: 'team-זר' }, HUB)).toBe(true);
    expect(canViewPackage(operationManager, { ...scope, sourceBaseId: 'base-זר' }, HUB)).toBe(
      true,
    );
  });

  it('רואה כל משימה וכל שליחות', () => {
    expect(canViewTask(operationManager, taskScope)).toBe(true);
    expect(canViewMission(operationManager, missionScope, HUB)).toBe(true);
    expect(canViewMission(operationManager, { ...missionScope, stopBaseIds: [] }, HUB)).toBe(
      true,
    );
  });

  it('רואה הנחיות נסיעה מאובטחת - הוא המפקד הבכיר במבצע', () => {
    expect(canViewSecuredTransportNotes(operationManager, missionScope)).toBe(true);
  });

  it('אינו עורך תכולת אריזה', () => {
    expect(canEditPackageContent(operationManager, scope)).toBe(false);
  });

  it('אינו מבצע משימה ואינו מבצע שליחות בשטח', () => {
    expect(canExecuteTask(operationManager, taskScope)).toBe(false);
    expect(canExecuteMission(operationManager, missionScope)).toBe(false);
  });

  it('אינו קולט ואינו מפזר בקריית התקשוב, גם כשהוא מוצב בה', () => {
    expect(canHandleAtHub(operationManager, scope, HUB)).toBe(false);
  });
});
