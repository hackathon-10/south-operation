import { PackageStatus, PackingTaskStatus, TaskPriority } from '@south/shared';
import {
  AMBER_READY_HOURS,
  RED_READY_HOURS,
  type HealthInput,
  evaluateHealth,
  worstHealth,
} from './operation-health';

const NOW = new Date('2026-09-23T12:00:00.000Z');

/** ברירת מחדל תקינה לחלוטין - כל בדיקה משנה ממנה רק את מה שהיא בודקת. */
const healthy: HealthInput = {
  tasks: [{ status: PackingTaskStatus.IN_PROGRESS, priority: TaskPriority.URGENT }],
  readyPackages: [],
};

/** אריזה שממתינה לשילוח מזה מספר השעות שנמסר. */
const waiting = (hours: number, hasMission = false) => ({
  status: PackageStatus.READY_FOR_SHIPMENT,
  readySince: new Date(NOW.getTime() - hours * 60 * 60 * 1000),
  hasMission,
});

describe('חיווי בריאות ליחידה ולבסיס', () => {
  it('ירוק כשאין משימה דחופה תקועה ואין אריזה שממתינה', () => {
    expect(evaluateHealth(healthy, NOW).health).toBe('GREEN');
  });

  it('אדום כשמשימה דחופה עדיין לא התחילה', () => {
    const result = evaluateHealth(
      {
        ...healthy,
        tasks: [{ status: PackingTaskStatus.ASSIGNED, priority: TaskPriority.URGENT }],
      },
      NOW,
    );
    expect(result.health).toBe('RED');
    expect(result.reasons.join(' ')).toContain('דחופה');
  });

  it('משימה דחופה שכבר בביצוע אינה מדליקה אדום', () => {
    expect(
      evaluateHealth(
        {
          ...healthy,
          tasks: [{ status: PackingTaskStatus.IN_PROGRESS, priority: TaskPriority.URGENT }],
        },
        NOW,
      ).health,
    ).toBe('GREEN');
  });

  it('כתום כשמשימה בעדיפות גבוהה לא התחילה', () => {
    expect(
      evaluateHealth(
        {
          ...healthy,
          tasks: [{ status: PackingTaskStatus.ASSIGNED, priority: TaskPriority.HIGH }],
        },
        NOW,
      ).health,
    ).toBe('AMBER');
  });

  it('אדום כשאריזה מוכנה לשילוח ממתינה מעבר לסף האדום בלי שליחות', () => {
    const result = evaluateHealth(
      { ...healthy, readyPackages: [waiting(RED_READY_HOURS + 1)] },
      NOW,
    );
    expect(result.health).toBe('RED');
    expect(result.reasons.join(' ')).toContain('ממתינ');
  });

  it('כתום כשההמתנה חצתה את הסף הכתום בלבד', () => {
    expect(
      evaluateHealth({ ...healthy, readyPackages: [waiting(AMBER_READY_HOURS + 1)] }, NOW).health,
    ).toBe('AMBER');
  });

  it('אריזה שכבר שויכה לשליחות אינה נחשבת תקועה, כמה שתמתין', () => {
    expect(
      evaluateHealth(
        { ...healthy, readyPackages: [waiting(RED_READY_HOURS + 100, true)] },
        NOW,
      ).health,
    ).toBe('GREEN');
  });

  it('אדום גובר על כתום כששניהם מתקיימים', () => {
    const result = evaluateHealth(
      {
        tasks: [
          { status: PackingTaskStatus.ASSIGNED, priority: TaskPriority.URGENT },
          { status: PackingTaskStatus.ASSIGNED, priority: TaskPriority.HIGH },
        ],
        readyPackages: [waiting(AMBER_READY_HOURS + 1)],
      },
      NOW,
    );
    expect(result.health).toBe('RED');
    // הסיבות נשמרות כולן - המפקד רוצה לדעת גם מה הכתום, לא רק מה האדום.
    expect(result.reasons.length).toBeGreaterThan(1);
  });

  it('חיווי הבסיס הוא החמור מבין יחידותיו - יחידה אדומה אינה נבלעת', () => {
    expect(worstHealth(['GREEN', 'GREEN', 'RED'])).toBe('RED');
    expect(worstHealth(['GREEN', 'AMBER'])).toBe('AMBER');
    expect(worstHealth(['GREEN', 'GREEN'])).toBe('GREEN');
  });

  it('בסיס בלי יחידות כלל הוא ירוק, לא שגיאה', () => {
    expect(worstHealth([])).toBe('GREEN');
  });
});
