import { z } from 'zod';
import { JoinRequestStatus, MissionStatus, VehicleType } from '../enums';
import {
  isoDateTimeSchema,
  noteTextSchema,
  paginationQuerySchema,
  shortTextSchema,
  uuidSchema,
} from './common';

const securedTransportFields = {
  requiresSecuredTransport: z.boolean().default(false),
  /** הנחיות כלליות בלבד. מוצגות רק למשתמשים מורשים (§7.12). */
  securedTransportNotes: noteTextSchema.optional(),
};

// NoCyberHere: INPUT_VALIDATION
// Threat: יצירת שליחות חסרה או לא עקבית שמדלגת על כללי §8.6
// Reason: אימות תלות בין שדות (נסיעה מאובטחת מחייבת הנחיות) כבר בשכבת הקלט

export const createMissionSchema = z
  .object({
    title: shortTextSchema,
    plannedDepartureAt: isoDateTimeSchema,
    vehicleType: z.nativeEnum(VehicleType).default(VehicleType.TRUCK),
    vehicleDetails: shortTextSchema.optional(),
    licensePlate: z.string().trim().min(5).max(20).optional(),
    assignedSoldierId: uuidSchema.optional(),
    packageIds: z.array(uuidSchema).min(1, 'יש לבחור לפחות אריזה אחת'),
    /** סדר עצירות ידני לפי מזהי בסיס. אם לא נשלח, המערכת מציעה מסלול. */
    stopBaseOrder: z.array(uuidSchema).optional(),
    ...securedTransportFields,
  })
  .strict()
  .superRefine((mission, ctx) => {
    if (mission.requiresSecuredTransport && !mission.securedTransportNotes?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['securedTransportNotes'],
        message: 'כאשר נדרשת נסיעה מאובטחת יש להזין הנחיות',
      });
    }
    if (new Set(mission.packageIds).size !== mission.packageIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['packageIds'],
        message: 'אריזה נבחרה יותר מפעם אחת',
      });
    }
  });
export type CreateMissionInput = z.infer<typeof createMissionSchema>;

export const updateMissionSchema = z
  .object({
    title: shortTextSchema.optional(),
    plannedDepartureAt: isoDateTimeSchema.optional(),
    vehicleType: z.nativeEnum(VehicleType).optional(),
    vehicleDetails: shortTextSchema.nullable().optional(),
    licensePlate: z.string().trim().min(5).max(20).nullable().optional(),
    assignedSoldierId: uuidSchema.nullable().optional(),
    requiresSecuredTransport: z.boolean().optional(),
    securedTransportNotes: noteTextSchema.nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, { message: 'לא נשלחו שדות לעדכון' })
  .superRefine((mission, ctx) => {
    if (mission.requiresSecuredTransport === true && mission.securedTransportNotes === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['securedTransportNotes'],
        message: 'כאשר נדרשת נסיעה מאובטחת יש להזין הנחיות',
      });
    }
  });
export type UpdateMissionInput = z.infer<typeof updateMissionSchema>;

/** בקשת הצעת מסלול לפני שמירת השליחות. */
export const routeSuggestionSchema = z
  .object({
    packageIds: z.array(uuidSchema).min(1, 'יש לבחור לפחות אריזה אחת'),
  })
  .strict();
export type RouteSuggestionInput = z.infer<typeof routeSuggestionSchema>;

export const missionPackagesSchema = z
  .object({ packageIds: z.array(uuidSchema).min(1) })
  .strict();

export const reorderStopsSchema = z
  .object({ stopIds: z.array(uuidSchema).min(2, 'נדרשות לפחות שתי עצירות') })
  .strict()
  .superRefine((value, ctx) => {
    if (new Set(value.stopIds).size !== value.stopIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['stopIds'],
        message: 'עצירה מופיעה יותר מפעם אחת',
      });
    }
  });
export type ReorderStopsInput = z.infer<typeof reorderStopsSchema>;

export const missionActionSchema = z
  .object({
    idempotencyKey: z.string().trim().min(8).max(100).optional(),
    note: noteTextSchema.optional(),
  })
  .strict();

export const missionsQuerySchema = paginationQuerySchema
  .extend({
    status: z.nativeEnum(MissionStatus).optional(),
    assignedSoldierId: uuidSchema.optional(),
    baseId: uuidSchema.optional(),
    /** שליחויות שטרם יצאו - למסך בקשת הצטרפות של החייל. */
    joinable: z
      .enum(['true', 'false'])
      .transform((value) => value === 'true')
      .optional(),
  })
  .strict();
export type MissionsQuery = z.infer<typeof missionsQuerySchema>;

export const createJoinRequestSchema = z
  .object({
    packageIds: z.array(uuidSchema).min(1, 'יש לבחור לפחות אריזה אחת'),
    note: noteTextSchema.optional(),
  })
  .strict();
export type CreateJoinRequestInput = z.infer<typeof createJoinRequestSchema>;

export const reviewJoinRequestSchema = z
  .object({ note: noteTextSchema.optional() })
  .strict();

export const joinRequestsQuerySchema = paginationQuerySchema
  .extend({
    status: z.nativeEnum(JoinRequestStatus).optional(),
    transportMissionId: uuidSchema.optional(),
    baseId: uuidSchema.optional(),
    mine: z
      .enum(['true', 'false'])
      .transform((value) => value === 'true')
      .optional(),
  })
  .strict();
