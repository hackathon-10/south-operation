import { z } from 'zod';
import { TrackingMode } from '../enums';

/**
 * פורמט קובץ קליטת המיפוי משלב א׳ (§8.1).
 *
 * baseCode,unitCode,teamCode,building,floor,roomNumber,sku,productName,category,
 * trackingMode,quantity,assetTag,ownerName,ownerIdentityNumber
 *
 * שורת BULK: quantity נדרש, assetTag ריק.
 * שורת SERIALIZED: quantity=1, assetTag ו-ownerName נדרשים.
 */
export const MAPPING_IMPORT_COLUMNS = [
  'baseCode',
  'unitCode',
  'teamCode',
  'building',
  'floor',
  'roomNumber',
  'sku',
  'productName',
  'category',
  'trackingMode',
  'quantity',
  'assetTag',
  'ownerName',
  'ownerIdentityNumber',
] as const;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value.length === 0 ? undefined : value))
    .optional();

export const mappingImportRowSchema = z
  .object({
    baseCode: z.string().trim().min(1, 'חסר קוד בסיס').max(20),
    unitCode: z.string().trim().min(1, 'חסר קוד יחידה').max(30),
    teamCode: z.string().trim().min(1, 'חסר קוד צוות').max(30),
    building: z.string().trim().min(1, 'חסר בניין').max(80),
    floor: z.string().trim().min(1, 'חסרה קומה').max(10),
    roomNumber: z.string().trim().min(1, 'חסר מספר חדר').max(20),
    sku: z.string().trim().min(1, 'חסר מק״ט').max(40),
    productName: z.string().trim().min(1, 'חסר שם מוצר').max(120),
    category: z.string().trim().min(1, 'חסרה קטגוריה').max(60),
    trackingMode: z.nativeEnum(TrackingMode, {
      errorMap: () => ({ message: 'trackingMode חייב להיות SERIALIZED או BULK' }),
    }),
    quantity: z.coerce.number().int().min(0).default(0),
    assetTag: optionalText(60),
    ownerName: optionalText(120),
    ownerIdentityNumber: optionalText(20),
  })
  .strict()
  .superRefine((row, ctx) => {
    if (row.trackingMode === TrackingMode.SERIALIZED) {
      if (!row.assetTag) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['assetTag'],
          message: 'שורת SERIALIZED מחייבת assetTag',
        });
      }
      if (!row.ownerName) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['ownerName'],
          message: 'שורת SERIALIZED מחייבת ownerName',
        });
      }
      if (row.quantity !== 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['quantity'],
          message: 'שורת SERIALIZED מייצגת פריט פיזי אחד (quantity=1)',
        });
      }
    } else {
      if (row.assetTag) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['assetTag'],
          message: 'שורת BULK לא יכולה לכלול assetTag',
        });
      }
      if (row.quantity <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['quantity'],
          message: 'שורת BULK מחייבת כמות גדולה מאפס',
        });
      }
    }
  });
export type MappingImportRow = z.infer<typeof mappingImportRowSchema>;

export interface MappingImportError {
  line: number;
  field?: string;
  message: string;
}

export interface MappingImportResult {
  totalRows: number;
  importedRows: number;
  createdRooms: number;
  createdCatalogItems: number;
  createdAssets: number;
  updatedInventoryLines: number;
  errors: MappingImportError[];
}
