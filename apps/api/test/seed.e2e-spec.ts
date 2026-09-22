import { HUB_BUILDING_NAME } from '@south/shared';
import { runSeed } from '../prisma/seed';
import { createTestDatabase, type TestDatabase } from './test-database';

/**
 * בדיקות ל-Seed עצמו.
 * ה-Seed הוא הבסיס לכל ההדגמה, ולכן נבדק מול מסד אמיתי:
 * שהוא רץ עד הסוף, שהמונים עקביים ושאין ערכים שליליים.
 */
describe('Seed נתוני הדמה', () => {
  let database: TestDatabase;

  beforeAll(async () => {
    database = await createTestDatabase();
    process.env.SEED_DEMO_PASSWORD = 'Demo!2345';
    await runSeed(database.prisma);
  }, 180_000);

  afterAll(async () => {
    await database?.close();
  });

  it('יוצר את ארבעת הבסיסים כולל בסיס היעד', async () => {
    const bases = await database.prisma.base.findMany();
    expect(bases).toHaveLength(4);
    expect(bases.filter((base) => base.isDestinationHub)).toHaveLength(1);
    expect(bases.map((base) => base.code).sort()).toEqual(['GDN', 'KT', 'SHL', 'TZR']);
  });

  it('יוצר מפת חמש קומות עם 40 חדרים לחיצים', async () => {
    const floorMaps = await database.prisma.floorMap.findMany({
      where: { building: HUB_BUILDING_NAME },
    });
    expect(floorMaps).toHaveLength(5);

    const shapes = await database.prisma.roomMapShape.count();
    expect(shapes).toBe(40);

    for (const map of floorMaps) {
      const rooms = await database.prisma.room.count({ where: { floorMapId: map.id } });
      expect(rooms).toBe(8);
    }
  });

  it('יוצר לפחות 12 חדרי מקור ו-15 מק״טים', async () => {
    const sourceRooms = await database.prisma.room.count({ where: { floorMapId: null } });
    expect(sourceRooms).toBeGreaterThanOrEqual(12);

    const catalog = await database.prisma.productCatalogItem.count();
    expect(catalog).toBeGreaterThanOrEqual(15);

    const serialized = await database.prisma.productCatalogItem.count({
      where: { trackingMode: 'SERIALIZED' },
    });
    expect(serialized).toBeGreaterThan(0);
  });

  it('יוצר מחשבים ומסכים עם מזהה ייחודי ובעלים', async () => {
    const assets = await database.prisma.assetInstance.findMany();
    expect(assets.length).toBeGreaterThan(20);
    expect(assets.every((asset) => asset.assetTag.length > 3)).toBe(true);
    expect(assets.every((asset) => asset.ownerName.length > 1)).toBe(true);
    expect(new Set(assets.map((asset) => asset.assetTag)).size).toBe(assets.length);
  });

  it('יוצר משתמשי דמו לכל שלושת התפקידים', async () => {
    const roles = await database.prisma.user.groupBy({ by: ['role'], _count: { _all: true } });
    const byRole = Object.fromEntries(roles.map((row) => [row.role, row._count._all]));

    expect(byRole.LOGISTICS_COMMANDER).toBeGreaterThanOrEqual(1);
    expect(byRole.LOGISTICS_SOLDIER).toBeGreaterThanOrEqual(2);
    expect(byRole.TEAM_LEAD).toBeGreaterThanOrEqual(2);
  });

  it('לא שומר סיסמאות גלויות', async () => {
    const users = await database.prisma.user.findMany({ select: { passwordHash: true } });
    expect(users.every((user) => user.passwordHash.startsWith('$argon2'))).toBe(true);
    expect(users.every((user) => !user.passwordHash.includes('Demo!2345'))).toBe(true);
  });

  it('יוצר משימות, אריזות ושליחויות במצבים שונים כדי שה-Dashboard לא יהיה ריק', async () => {
    const taskStatuses = await database.prisma.packingTask.groupBy({
      by: ['status'],
      _count: { _all: true },
    });
    const packageStatuses = await database.prisma.package.groupBy({
      by: ['status'],
      _count: { _all: true },
    });
    const missionStatuses = await database.prisma.transportMission.groupBy({
      by: ['status'],
      _count: { _all: true },
    });

    expect(taskStatuses.length).toBeGreaterThanOrEqual(3);
    expect(packageStatuses.length).toBeGreaterThanOrEqual(4);
    expect(missionStatuses.length).toBeGreaterThanOrEqual(3);

    const statuses = packageStatuses.map((row) => row.status);
    expect(statuses).toContain('DELIVERED_TO_ROOM');
    expect(statuses).toContain('IN_TRANSIT');
    expect(statuses).toContain('READY_FOR_SHIPMENT');
    expect(statuses).toContain('OPEN');
  });

  it('יוצר בקשת הצטרפות ממתינה לאישור', async () => {
    const pending = await database.prisma.missionJoinRequest.count({
      where: { status: 'PENDING' },
    });
    expect(pending).toBeGreaterThanOrEqual(1);
  });

  it('מונֵי המלאי עקביים ואין ערכים שליליים', async () => {
    const inventory = await database.prisma.roomInventory.findMany();

    for (const line of inventory) {
      expect(line.mappedQuantity).toBeGreaterThanOrEqual(0);
      expect(line.reservedQuantity).toBeGreaterThanOrEqual(0);
      expect(line.packedQuantity).toBeGreaterThanOrEqual(0);
      expect(line.deliveredQuantity).toBeGreaterThanOrEqual(0);
      expect(line.reservedQuantity + line.packedQuantity).toBeLessThanOrEqual(line.mappedQuantity);
    }
  });

  it('כמות שנארזה בשורות המשימה תואמת לתכולת האריזות בפועל', async () => {
    const tasks = await database.prisma.packingTask.findMany({
      include: {
        lines: true,
        packages: { include: { assets: true, bulkLines: true } },
      },
    });

    for (const task of tasks) {
      for (const line of task.lines) {
        const packedInPackages = line.assetInstanceId
          ? task.packages.filter((pkg) =>
              pkg.assets.some((asset) => asset.assetInstanceId === line.assetInstanceId),
            ).length
          : task.packages
              .flatMap((pkg) => pkg.bulkLines)
              .filter((bulk) => bulk.productCatalogItemId === line.productCatalogItemId)
              .reduce((sum, bulk) => sum + bulk.quantity, 0);

        expect(line.packedQuantity).toBe(packedInPackages);
      }
    }
  });

  it('לכל אריזה יש Token אקראי וייחודי שאינו נגזר ממספר האריזה', async () => {
    const packages = await database.prisma.package.findMany({
      select: { packageNumber: true, publicToken: true },
    });

    expect(new Set(packages.map((pkg) => pkg.publicToken)).size).toBe(packages.length);
    for (const pkg of packages) {
      expect(pkg.publicToken.length).toBeGreaterThanOrEqual(32);
      expect(pkg.publicToken).not.toContain(pkg.packageNumber.replace('PKG-', ''));
    }
  });

  it('הרצפים מסונכרנים כך שמזהה חדש לא יתנגש עם ה-Seed', async () => {
    const [nextPackage] = await database.prisma.$queryRaw<Array<{ value: bigint }>>`
      SELECT nextval('package_number_seq') AS value
    `;
    const maxExisting = await database.prisma.package.findFirst({
      orderBy: { packageNumber: 'desc' },
      select: { packageNumber: true },
    });

    const maxNumber = Number(maxExisting!.packageNumber.replace('PKG-', ''));
    expect(Number(nextPackage.value)).toBeGreaterThan(maxNumber);
  });
});
