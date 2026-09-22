import { z } from 'zod';
import { AssetStatus, MappingStatus, TrackingMode } from '../enums';
import { paginationQuerySchema, searchSchema, uuidSchema } from './common';

export const basesQuerySchema = z
  .object({
    isDestinationHub: z
      .enum(['true', 'false'])
      .transform((value) => value === 'true')
      .optional(),
  })
  .strict();

export const unitsQuerySchema = z.object({ baseId: uuidSchema.optional() }).strict();

export const teamsQuerySchema = z
  .object({
    baseId: uuidSchema.optional(),
    unitId: uuidSchema.optional(),
    search: searchSchema,
  })
  .strict();

export const roomsQuerySchema = paginationQuerySchema
  .extend({
    baseId: uuidSchema.optional(),
    unitId: uuidSchema.optional(),
    teamId: uuidSchema.optional(),
    building: z.string().trim().max(80).optional(),
    floor: z.string().trim().max(10).optional(),
    mappingStatus: z.nativeEnum(MappingStatus).optional(),
    search: searchSchema,
  })
  .strict();

export const floorMapsQuerySchema = z
  .object({
    baseId: uuidSchema.optional(),
    building: z.string().trim().max(80).optional(),
  })
  .strict();

export const catalogQuerySchema = paginationQuerySchema
  .extend({
    search: searchSchema,
    category: z.string().trim().max(80).optional(),
    trackingMode: z.nativeEnum(TrackingMode).optional(),
  })
  .strict();

export const assetsQuerySchema = paginationQuerySchema
  .extend({
    roomId: uuidSchema.optional(),
    /** חיפוש לפי assetTag או שם בעלים - שדה חיפוש אחד למסך השטח. */
    search: searchSchema,
    status: z.nativeEnum(AssetStatus).optional(),
    packingTaskId: uuidSchema.optional(),
  })
  .strict();

/** חיפוש חוצה-מפה: מספר חדר, צוות, בעלים, assetTag או מק״ט. */
export const roomMapSearchQuerySchema = z
  .object({
    baseId: uuidSchema.optional(),
    building: z.string().trim().max(80).optional(),
    query: z.string().trim().min(1).max(80),
  })
  .strict();
