import { PackingTaskStatus, TaskPriority } from '@south/shared';

/**
 * כללי חיווי הבריאות של בסיס ויחידה בדשבורד מפקד המבצע.
 *
 * הקובץ טהור ואינו יודע דבר על Prisma, בדיוק כמו `access-control.ts`:
 * הכלל העסקי נבדק ביחידה, והשאילתה רק מזינה אותו.
 *
 * סרגל ההתקדמות עונה "כמה רחוק הגענו". החיווי עונה "לאן להסתכל עכשיו",
 * וזה מה שמפקד מבצע צריך.
 */

export type Health = 'GREEN' | 'AMBER' | 'RED';

/** מעל כמה שעות המתנה לשילוח, בלי שליחות משויכת, האריזה נחשבת תקועה. */
export const RED_READY_HOURS = 24;
/** מעל כמה שעות המתנה האריזה מתחילה להדאיג. */
export const AMBER_READY_HOURS = 12;

export interface HealthTaskInput {
  status: PackingTaskStatus;
  priority: TaskPriority;
}

export interface HealthPackageInput {
  /** הרגע שבו האריזה עברה ל-READY_FOR_SHIPMENT. */
  readySince: Date;
  /** האם כבר שויכה לשליחות. אריזה משויכת אינה תקועה, גם אם ממתינה. */
  hasMission: boolean;
}

export interface HealthInput {
  tasks: HealthTaskInput[];
  /** אריזות שנמצאות כרגע במצב "מוכנה לשילוח" בלבד. */
  readyPackages: HealthPackageInput[];
}

export interface HealthResult {
  health: Health;
  /** כל הסיבות שנמצאו, בעברית, לתצוגה ישירה. לא רק החמורה שבהן. */
  reasons: string[];
}

const SEVERITY: Record<Health, number> = { GREEN: 0, AMBER: 1, RED: 2 };

/** החמור מבין החיוויים. בסיס בלי יחידות הוא ירוק. */
export function worstHealth(values: Health[]): Health {
  return values.reduce<Health>(
    (worst, value) => (SEVERITY[value] > SEVERITY[worst] ? value : worst),
    'GREEN',
  );
}

const hoursBetween = (from: Date, to: Date): number =>
  (to.getTime() - from.getTime()) / (60 * 60 * 1000);

const notStarted = (task: HealthTaskInput): boolean =>
  task.status === PackingTaskStatus.ASSIGNED;

export function evaluateHealth(input: HealthInput, now: Date): HealthResult {
  const reasons: string[] = [];
  let health: Health = 'GREEN';

  const raise = (level: Health, reason: string): void => {
    reasons.push(reason);
    if (SEVERITY[level] > SEVERITY[health]) health = level;
  };

  const urgentStuck = input.tasks.filter(
    (task) => notStarted(task) && task.priority === TaskPriority.URGENT,
  ).length;
  if (urgentStuck > 0) {
    raise('RED', `${urgentStuck} משימה דחופה שטרם התחילה`);
  }

  const highStuck = input.tasks.filter(
    (task) => notStarted(task) && task.priority === TaskPriority.HIGH,
  ).length;
  if (highStuck > 0) {
    raise('AMBER', `${highStuck} משימה בעדיפות גבוהה שטרם התחילה`);
  }

  // אריזה שכבר שויכה לשליחות אינה תקועה - יש לה תאריך יציאה.
  const orphanWaits = input.readyPackages
    .filter((pkg) => !pkg.hasMission)
    .map((pkg) => hoursBetween(pkg.readySince, now));

  const redWaits = orphanWaits.filter((hours) => hours > RED_READY_HOURS).length;
  if (redWaits > 0) {
    raise('RED', `${redWaits} אריזה ממתינה לשילוח מעל ${RED_READY_HOURS} שעות בלי שליחות`);
  } else {
    const amberWaits = orphanWaits.filter((hours) => hours > AMBER_READY_HOURS).length;
    if (amberWaits > 0) {
      raise('AMBER', `${amberWaits} אריזה ממתינה לשילוח מעל ${AMBER_READY_HOURS} שעות`);
    }
  }

  return { health, reasons };
}
