import { z } from 'zod';
import { PackingTaskStatus, TaskPriority } from '../enums';
import {
  isoDateTimeSchema,
  noteTextSchema,
  paginationQuerySchema,
  positiveIntSchema,
  searchSchema,
  uuidSchema,
} from './common';

// NoCyberHere: INPUT_VALIDATION
// Threat: יצירת משימה עם שורות לא עקביות או כמויות שליליות שמובילות לשיבוש מלאי
// Reason: אכיפת כללי §7.9 (SERIALIZED מול BULK) כבר בשכבת הקלט

export const packingTaskLineInputSchema = z
  .object({
    productCatalogItemId: uuidSchema,
    /** נדרש עבור מחשב/מסך (SERIALIZED), אסור עבור ציוד כמותי (BULK). */
    assetInstanceId: uuidSchema.optional(),
    requestedQuantity: positiveIntSchema,
  })
  .strict()
  .superRefine((line, ctx) => {
    if (line.assetInstanceId && line.requestedQuantity !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['requestedQuantity'],
        message: 'פריט ייחודי נארז תמיד בכמות 1',
      });
    }
  });
export type PackingTaskLineInput = z.infer<typeof packingTaskLineInputSchema>;

export const createPackingTaskSchema = z
  .object({
    sourceRoomId: uuidSchema,
    destinationRoomId: uuidSchema,
    teamId: uuidSchema,
    assignedSoldierId: uuidSchema,
    priority: z.nativeEnum(TaskPriority).default(TaskPriority.NORMAL),
    dueAt: isoDateTimeSchema.optional(),
    notes: noteTextSchema.optional(),
    lines: z.array(packingTaskLineInputSchema).min(1, 'יש לבחור לפחות פריט אחד למשימה'),
  })
  .strict()
  .superRefine((task, ctx) => {
    const assetIds = task.lines
      .map((line) => line.assetInstanceId)
      .filter((id): id is string => Boolean(id));
    if (new Set(assetIds).size !== assetIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['lines'],
        message: 'אותו פריט ייחודי נבחר יותר מפעם אחת',
      });
    }
    const bulkKeys = task.lines
      .filter((line) => !line.assetInstanceId)
      .map((line) => line.productCatalogItemId);
    if (new Set(bulkKeys).size !== bulkKeys.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['lines'],
        message: 'אותו מק״ט מופיע ביותר משורה אחת. אחדו את הכמויות',
      });
    }
  });
export type CreatePackingTaskInput = z.infer<typeof createPackingTaskSchema>;

/** עדכון חלקי - רק שדות ניהוליים. שינוי תכולת המשימה נעשה דרך יצירה מחדש. */
export const updatePackingTaskSchema = z
  .object({
    priority: z.nativeEnum(TaskPriority).optional(),
    dueAt: isoDateTimeSchema.nullable().optional(),
    notes: noteTextSchema.nullable().optional(),
    assignedSoldierId: uuidSchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, { message: 'לא נשלחו שדות לעדכון' });
export type UpdatePackingTaskInput = z.infer<typeof updatePackingTaskSchema>;

export const cancelPackingTaskSchema = z
  .object({ reason: noteTextSchema.optional() })
  .strict();

export const packingTasksQuerySchema = paginationQuerySchema
  .extend({
    status: z.nativeEnum(PackingTaskStatus).optional(),
    priority: z.nativeEnum(TaskPriority).optional(),
    assignedSoldierId: uuidSchema.optional(),
    teamId: uuidSchema.optional(),
    baseId: uuidSchema.optional(),
    sourceRoomId: uuidSchema.optional(),
    /** true = רק המשימות שלי. נאכף גם בשרת לפי המשתמש המחובר. */
    mine: z
      .enum(['true', 'false'])
      .transform((value) => value === 'true')
      .optional(),
    search: searchSchema,
  })
  .strict();
export type PackingTasksQuery = z.infer<typeof packingTasksQuerySchema>;
