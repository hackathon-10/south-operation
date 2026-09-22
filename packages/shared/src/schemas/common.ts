import { z } from 'zod';
import { PAGINATION } from '../constants';

// NoCyberHere: INPUT_VALIDATION
// Threat: קלט זדוני או שגוי מהמשתמש (Injection, Mass Assignment, Enumeration)
// Reason: כל קלט מהלקוח עובר סכמת Zod קשיחה לפני שהוא מגיע ללוגיקה העסקית ולמסד.

/** מזהה פנימי - תמיד UUID. חוסם ניסיונות להזריק ערכים חופשיים לנתיבים. */
export const uuidSchema = z.string().uuid({ message: 'מזהה לא תקין' });

export const idParamSchema = z.object({ id: uuidSchema }).strict();
export type IdParam = z.infer<typeof idParamSchema>;

/** טקסט חופשי קצר - נשמר כטקסט בלבד, מוגבל באורך כדי למנוע ניפוח בקשות. */
export const shortTextSchema = z.string().trim().min(1).max(200);
export const noteTextSchema = z.string().trim().max(1000);

export const positiveIntSchema = z.coerce
  .number({ invalid_type_error: 'יש להזין מספר' })
  .int('יש להזין מספר שלם')
  .positive('הכמות חייבת להיות גדולה מאפס');

export const nonNegativeIntSchema = z.coerce.number().int().min(0);

export const isoDateTimeSchema = z
  .string()
  .datetime({ offset: true, message: 'תאריך או שעה אינם תקינים' });

/** Pagination אחיד לכל הרשימות. */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(PAGINATION.defaultPage),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(PAGINATION.maxPageSize)
    .default(PAGINATION.defaultPageSize),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export const sortOrderSchema = z.enum(['asc', 'desc']).default('desc');

/** מחרוזת חיפוש חופשית. מוגבלת באורך ומשמשת רק ב-contains של Prisma (פרמטרי). */
export const searchSchema = z.string().trim().min(1).max(80).optional();

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/** ממיר רשימת ערכים שהגיעה כ-CSV או כמערך לערכים בדידים. */
export function csvArray<T extends z.ZodTypeAny>(item: T) {
  return z.preprocess((value) => {
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean);
    }
    return value;
  }, z.array(item));
}
