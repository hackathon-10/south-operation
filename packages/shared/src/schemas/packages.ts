import { z } from 'zod';
import { PackageStatus, PackageType } from '../enums';
import {
  noteTextSchema,
  paginationQuerySchema,
  positiveIntSchema,
  searchSchema,
  uuidSchema,
} from './common';

export const createPackageSchema = z
  .object({
    packageType: z.nativeEnum(PackageType),
    /** האחראי על האריזה - נבחר על ידי החייל בעת הפתיחה. */
    responsibleUserId: uuidSchema,
    notes: noteTextSchema.optional(),
  })
  .strict();
export type CreatePackageInput = z.infer<typeof createPackageSchema>;

export const updatePackageSchema = z
  .object({
    packageType: z.nativeEnum(PackageType).optional(),
    responsibleUserId: uuidSchema.optional(),
    notes: noteTextSchema.nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, { message: 'לא נשלחו שדות לעדכון' });
export type UpdatePackageInput = z.infer<typeof updatePackageSchema>;

/** הוספת מחשב/מסך לאריזה - לפי מזהה פנימי או לפי המזהה שעל המדבקה. */
export const addPackageAssetSchema = z
  .object({
    assetInstanceId: uuidSchema.optional(),
    assetTag: z.string().trim().min(2).max(60).optional(),
  })
  .strict()
  .refine((value) => Boolean(value.assetInstanceId || value.assetTag), {
    message: 'יש לבחור פריט או להזין את המזהה שעל המדבקה',
  });
export type AddPackageAssetInput = z.infer<typeof addPackageAssetSchema>;

export const addPackageBulkLineSchema = z
  .object({
    productCatalogItemId: uuidSchema,
    quantity: positiveIntSchema,
  })
  .strict();
export type AddPackageBulkLineInput = z.infer<typeof addPackageBulkLineSchema>;

export const updatePackageBulkLineSchema = z
  .object({ quantity: positiveIntSchema })
  .strict();

export const reopenPackageSchema = z.object({ reason: noteTextSchema.optional() }).strict();

/**
 * Idempotency לפעולות סריקה (§11): סריקה חוזרת של אותה אריזה
 * עם אותו מפתח לא תיצור פעולה כפולה.
 */
export const scanActionSchema = z
  .object({
    idempotencyKey: z.string().trim().min(8).max(100).optional(),
    note: noteTextSchema.optional(),
  })
  .strict();
export type ScanActionInput = z.infer<typeof scanActionSchema>;

/** ה-Token של ה-QR: אקראי, אטום, ללא מידע עסקי. */
export const publicTokenSchema = z
  .string()
  .trim()
  .min(20, 'קוד הסריקה אינו תקין')
  .max(120)
  .regex(/^[A-Za-z0-9_-]+$/, 'קוד הסריקה אינו תקין');

export const packagesQuerySchema = paginationQuerySchema
  .extend({
    status: z.nativeEnum(PackageStatus).optional(),
    teamId: uuidSchema.optional(),
    baseId: uuidSchema.optional(),
    sourceRoomId: uuidSchema.optional(),
    destinationRoomId: uuidSchema.optional(),
    packingTaskId: uuidSchema.optional(),
    missionId: uuidSchema.optional(),
    /** אריזות מוכנות לשילוח וללא שליחות - למסך בניית שליחות. */
    availableForMission: z
      .enum(['true', 'false'])
      .transform((value) => value === 'true')
      .optional(),
    /** חיפוש לפי מספר אריזה, בעלים או assetTag. */
    search: searchSchema,
  })
  .strict();
export type PackagesQuery = z.infer<typeof packagesQuerySchema>;
