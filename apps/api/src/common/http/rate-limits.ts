/**
 * מגבלות קצב, במקום אחד.
 *
 * NoCyberHere: RATE_LIMITING
 * Threat: Brute force על מסך ההתחברות
 * Reason: מגבלה הדוקה על נתיב ההתחברות, 10 ניסיונות ל-15 דקות.
 *
 * הערך ניתן לעקיפה דרך משתנה סביבה כדי שחבילת הבדיקות תוכל להתחבר בשם כל
 * התפקידים בלי להיחסם. ברירת המחדל היא ערך הפרודקשן, וכל ערך לא תקין חוזר
 * אליה - כלומר תקלת תצורה מקשיחה את הבקרה ולא מרפה אותה.
 */

const DEFAULT_AUTH_LIMIT = 10;

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
