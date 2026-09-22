import { parse } from 'csv-parse/sync';
import type { PrismaClient } from '@prisma/client';
import {
  MAPPING_IMPORT_COLUMNS,
  MappingImportError,
  MappingImportResult,
  TrackingMode,
  mappingImportRowSchema,
} from '@south/shared';

/**
 * קליטת קובץ המיפוי של שלב א׳ (§8.1).
 *
 * העיצוב: Validation לכל שורה עם מספר שורה בשגיאה, ו-Upsert על מפתחות עסקיים
 * כדי שההרצה תהיה Idempotent - הרצה חוזרת של אותו קובץ לא תכפיל נתונים.
 *
 * NoCyberHere: INPUT_VALIDATION
 * Threat: קובץ קלט זדוני או שגוי שמזהם את המיפוי
 * Reason: כל שורה עוברת סכמת Zod קשיחה לפני שהיא נכתבת למסד; שורה לא תקינה נדחית עם סיבה.
 */
export async function importMappingCsv(
  prisma: PrismaClient,
  csvText: string,
): Promise<MappingImportResult> {
  const errors: MappingImportError[] = [];
  const result: MappingImportResult = {
    totalRows: 0,
    importedRows: 0,
    createdRooms: 0,
    createdCatalogItems: 0,
    createdAssets: 0,
    updatedInventoryLines: 0,
    errors,
  };

  let records: Array<Record<string, string>>;
  try {
    records = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
    }) as Array<Record<string, string>>;
  } catch {
    errors.push({ line: 1, message: 'לא ניתן לקרוא את הקובץ. ודאו שזהו קובץ CSV תקין' });
    return result;
  }

  if (records.length === 0) {
    errors.push({ line: 1, message: 'הקובץ ריק' });
    return result;
  }

  const header = Object.keys(records[0]);
  const missingColumns = MAPPING_IMPORT_COLUMNS.filter((column) => !header.includes(column));
  if (missingColumns.length > 0) {
    errors.push({ line: 1, message: `חסרות עמודות בקובץ: ${missingColumns.join(', ')}` });
    return result;
  }

  result.totalRows = records.length;

  for (const [index, record] of records.entries()) {
    // שורה 1 היא הכותרת, ולכן שורת הנתונים הראשונה היא 2.
    const line = index + 2;
    const parsed = mappingImportRowSchema.safeParse(record);

    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        errors.push({
          line,
          field: issue.path.join('.') || undefined,
          message: issue.message,
        });
      }
      continue;
    }

    const row = parsed.data;

    try {
      const base = await prisma.base.findUnique({ where: { code: row.baseCode } });
      if (!base) {
        errors.push({ line, field: 'baseCode', message: `בסיס ${row.baseCode} אינו קיים במערכת` });
        continue;
      }

      const unit = await prisma.organizationalUnit.upsert({
        where: { baseId_code: { baseId: base.id, code: row.unitCode } },
        create: { baseId: base.id, code: row.unitCode, name: row.unitCode, type: 'UNIT' },
        update: {},
      });

      const team = await prisma.team.upsert({
        where: { unitId_code: { unitId: unit.id, code: row.teamCode } },
        create: { unitId: unit.id, code: row.teamCode, name: row.teamCode },
        update: {},
      });

      const existingRoom = await prisma.room.findUnique({
        where: {
          baseId_building_floor_roomNumber: {
            baseId: base.id,
            building: row.building,
            floor: row.floor,
            roomNumber: row.roomNumber,
          },
        },
      });

      const room =
        existingRoom ??
        (await prisma.room.create({
          data: {
            baseId: base.id,
            unitId: unit.id,
            teamId: team.id,
            building: row.building,
            floor: row.floor,
            roomNumber: row.roomNumber,
            displayName: `${row.building} · חדר ${row.roomNumber}`,
            mappingStatus: 'MAPPED',
          },
        }));
      if (!existingRoom) result.createdRooms += 1;

      const existingProduct = await prisma.productCatalogItem.findUnique({
        where: { sku: row.sku },
      });
      const product =
        existingProduct ??
        (await prisma.productCatalogItem.create({
          data: {
            sku: row.sku,
            name: row.productName,
            category: row.category,
            trackingMode: row.trackingMode,
          },
        }));
      if (!existingProduct) result.createdCatalogItems += 1;

      if (product.trackingMode !== row.trackingMode) {
        errors.push({
          line,
          field: 'trackingMode',
          message: `המק״ט ${row.sku} מוגדר כבר כ-${product.trackingMode} במערכת`,
        });
        continue;
      }

      if (row.trackingMode === TrackingMode.SERIALIZED) {
        const existingAsset = await prisma.assetInstance.findUnique({
          where: { assetTag: row.assetTag! },
        });

        if (existingAsset) {
          // Upsert על מפתח עסקי: עדכון בעלים ומיקום בלבד, בלי לשנות סטטוס תפעולי.
          await prisma.assetInstance.update({
            where: { id: existingAsset.id },
            data: {
              ownerName: row.ownerName!,
              ownerIdentityNumber: row.ownerIdentityNumber ?? null,
              currentRoomId: room.id,
              productCatalogItemId: product.id,
            },
          });
        } else {
          await prisma.assetInstance.create({
            data: {
              assetTag: row.assetTag!,
              productCatalogItemId: product.id,
              ownerName: row.ownerName!,
              ownerIdentityNumber: row.ownerIdentityNumber ?? null,
              currentRoomId: room.id,
              status: 'AVAILABLE',
            },
          });
          result.createdAssets += 1;
        }
      } else {
        // כמות מהקובץ היא המיפוי הקובע; המונים התפעוליים אינם נדרסים.
        await prisma.roomInventory.upsert({
          where: {
            roomId_productCatalogItemId: { roomId: room.id, productCatalogItemId: product.id },
          },
          create: {
            roomId: room.id,
            productCatalogItemId: product.id,
            mappedQuantity: row.quantity,
          },
          update: { mappedQuantity: row.quantity },
        });
        result.updatedInventoryLines += 1;
      }

      result.importedRows += 1;
    } catch (error) {
      errors.push({
        line,
        message: 'השורה נכשלה בשמירה. ודאו שהנתונים עקביים עם המיפוי הקיים',
      });
    }
  }

  return result;
}
