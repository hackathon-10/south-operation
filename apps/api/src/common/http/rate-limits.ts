/**
 * מגבלות קצב, במקום אחד.
 *
 * NoCyberHere: RATE_LIMITING
 * Threat: Brute force על מסך ההתחברות
 * Reason: מגבלה הדוקה על נתיב ההתחברות, 50 ניסיונות ל-15 דקות לכל לקוח.
 *
 * הערך ניתן לעקיפה דרך משתנה סביבה כדי שחבילת הבדיקות תוכל להתחבר בשם כל
 * התפקידים בלי להיחסם. ברירת המחדל היא ערך הפרודקשן, וכל ערך לא תקין חוזר
 * אליה - כלומר תקלת תצורה מקשיחה את הבקרה ולא מרפה אותה.
 *
 * הערך הועלה מ-10 ל-50 יחד עם התיקון ל-`trust proxy` ב-bootstrap.ts: לפני
 * התיקון req.ip מאחורי ה-Proxy של Vercel היה זהה לכל המשתמשים, ולכן 10
 * ההתחברויות היו מכסה גלובלית אחת לכל המערכת ולא מכסה ללקוח.
 */

const DEFAULT_AUTH_LIMIT = 50;

function positiveIntFromEnv(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/** חלון הזמן של מגבלת ההתחברות, במילישניות. */
export const AUTH_RATE_TTL_MS = 900_000;

/** מספר ניסיונות ההתחברות המותרים בחלון. */
export const AUTH_RATE_LIMIT = positiveIntFromEnv('AUTH_RATE_LIMIT', DEFAULT_AUTH_LIMIT);

/** חידוש Token אינו ניסיון התחברות, ולכן מגבלתו רחבה יותר. */
export const REFRESH_RATE_LIMIT = AUTH_RATE_LIMIT * 6;
