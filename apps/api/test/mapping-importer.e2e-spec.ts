import { importMappingCsv } from '../src/modules/inventory/mapping-importer';
import { createTestDatabase, type TestDatabase } from './test-database';

/**
 * בדיקת אינטגרציה ל-Importer של מיפוי שלב א׳ (§8.1), מול מסד PostgreSQL אמיתי
 * בתוך התהליך (PGlite) - ראו HANDOFF.md §4 עדיפות 1 סעיף 6: הרכיב הזה עדיין לא
 * היה מכוסה בבדיקה אוטומטית.
 */
describe('Importer - קליטת מיפוי CSV', () => {
  let database: TestDatabase;

  const HEADER =
    'baseCode,unitCode,teamCode,building,floor,roomNumber,sku,productName,category,trackingMode,quantity,assetTag,ownerName,ownerIdentityNumber';

  beforeAll(async () => {
    database = await createTestDatabase();
    await database.prisma.base.create({
      data: {
        code: 'TST',
        name: 'בסיס בדיקה',
        addressText: 'כתובת בדיקה',
        latitude: 31.5,
        longitude: 34.5,
      },
    });
  });

  afterAll(async () => {
    await database.close();
  });

  it('קולט שורת BULK ושורת SERIALIZED, ויוצר יחידה/צוות/חדר/קטלוג/מלאי/פריט', async () => {
    const csv = [
      HEADER,
      'TST,T-UNIT,T-TEAM,בניין 1,1,101,ACC-MOUSE,עכבר אלחוטי,ציוד היקפי,BULK,5,,,',
      'TST,T-UNIT,T-TEAM,בניין 1,1,101,LT-PRO-16,מחשב נייד 16 אינץ׳,מחשבים,SERIALIZED,1,LT-TEST-001,טוראי בדיקה,',
    ].join('\n');

    const result = await importMappingCsv(database.prisma, csv);

    expect(result.errors).toEqual([]);
    expect(result.totalRows).toBe(2);
    expect(result.importedRows).toBe(2);
    expect(result.createdRooms).toBe(1);
    expect(result.createdCatalogItems).toBe(2);
    expect(result.createdAssets).toBe(1);
    expect(result.updatedInventoryLines).toBe(1);

    const room = await database.prisma.room.findFirst({ where: { roomNumber: '101' } });
    expect(room).not.toBeNull();

    const inventory = await database.prisma.roomInventory.findFirst({
      where: { roomId: room!.id },
    });
    expect(inventory?.mappedQuantity).toBe(5);

    const asset = await database.prisma.assetInstance.findUnique({
      where: { assetTag: 'LT-TEST-001' },
    });
    expect(asset?.ownerName).toBe('טוראי בדיקה');
    expect(asset?.currentRoomId).toBe(room!.id);
  });

  it('הרצה חוזרת של אותו קובץ היא Idempotent - לא יוצרת כפילויות', async () => {
    const csv = [
      HEADER,
      'TST,T-UNIT,T-TEAM,בניין 1,1,101,ACC-MOUSE,עכבר אלחוטי,ציוד היקפי,BULK,5,,,',
      'TST,T-UNIT,T-TEAM,בניין 1,1,101,LT-PRO-16,מחשב נייד 16 אינץ׳,מחשבים,SERIALIZED,1,LT-TEST-001,טוראי בדיקה,',
    ].join('\n');

    const result = await importMappingCsv(database.prisma, csv);

    expect(result.errors).toEqual([]);
    expect(result.importedRows).toBe(2);
    expect(result.createdRooms).toBe(0);
    expect(result.createdCatalogItems).toBe(0);
    expect(result.createdAssets).toBe(0);

    const rooms = await database.prisma.room.findMany({ where: { roomNumber: '101' } });
    expect(rooms).toHaveLength(1);
  });

  it('דוחה שורה עם בסיס שאינו קיים, עם מספר שורה מדויק בשגיאה', async () => {
    const csv = [
      HEADER,
      'NOPE,T-UNIT,T-TEAM,בניין 1,1,999,ACC-MOUSE,עכבר אלחוטי,ציוד היקפי,BULK,3,,,',
    ].join('\n');

    const result = await importMappingCsv(database.prisma, csv);

    expect(result.importedRows).toBe(0);
    expect(result.errors).toEqual([
      { line: 2, field: 'baseCode', message: 'בסיס NOPE אינו קיים במערכת' },
    ]);
  });

  it('דוחה שורה שלא עוברת את סכמת Zod (BULK עם assetTag) עם שם השדה השגוי', async () => {
    const csv = [
      HEADER,
      'TST,T-UNIT,T-TEAM,בניין 1,1,101,ACC-MOUSE,עכבר אלחוטי,ציוד היקפי,BULK,5,LT-SHOULD-NOT-HAVE-TAG,,',
    ].join('\n');

    const result = await importMappingCsv(database.prisma, csv);

    expect(result.importedRows).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({ line: 2, field: 'assetTag' });
  });

  it('דוחה קובץ עם עמודות חסרות', async () => {
    const result = await importMappingCsv(database.prisma, 'baseCode,unitCode\nTST,T-UNIT');

    expect(result.importedRows).toBe(0);
    expect(result.errors[0].message).toContain('חסרות עמודות בקובץ');
  });
});
