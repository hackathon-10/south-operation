import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { API_PREFIX } from '../src/bootstrap';
import { AllExceptionsFilter } from '../src/common/errors/all-exceptions.filter';
import { TraceIdMiddleware } from '../src/common/http/trace-id.middleware';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { TEST_PASSWORD, seedFixtures, type Fixtures } from './fixtures';
import { createTestDatabase, type TestDatabase } from './test-database';

/**
 * בדיקות אינטגרציה מקצה לקצה מול API אמיתי ומסד PostgreSQL אמיתי (PGlite בתהליך).
 * מכסות את כל הזרימה המרכזית של §14 באפיון.
 */
describe('המעבר דרומה - זרימה מלאה', () => {
  let app: INestApplication;
  let database: TestDatabase;
  let fixtures: Fixtures;

  const api = (path: string) => `/${API_PREFIX}${path}`;

  let commanderToken: string;
  let operationCommanderToken: string;
  let soldierGdnToken: string;
  let soldierTzrToken: string;
  let soldierHubToken: string;
  let teamLeadToken: string;
  let otherTeamLeadToken: string;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function login(email: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post(api('/auth/login'))
      .send({ email, password: TEST_PASSWORD })
      .expect(200);
    return response.body.accessToken as string;
  }

  beforeAll(async () => {
    database = await createTestDatabase();
    fixtures = await seedFixtures(database.prisma);

    const prismaStub = Object.assign(database.prisma, {
      isHealthy: async () => true,
      enableShutdownHooks: () => undefined,
      onModuleInit: async () => undefined,
      onModuleDestroy: async () => undefined,
    });

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prismaStub)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix(API_PREFIX);
    app.use(new TraceIdMiddleware().use.bind(new TraceIdMiddleware()));
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();

    commanderToken = await login('commander@test.demo');
    operationCommanderToken = await login('operation@test.demo');
    soldierGdnToken = await login('soldier.gdn@test.demo');
    soldierTzrToken = await login('soldier.tzr@test.demo');
    soldierHubToken = await login('soldier.hub@test.demo');
    teamLeadToken = await login('lead.dev@test.demo');
    otherTeamLeadToken = await login('lead.lab@test.demo');
  });

  afterAll(async () => {
    await app?.close();
    await database?.close();
  });

  // ============================================================
  // התחברות והרשאות
  // ============================================================

  describe('התחברות', () => {
    it('מחזירה Access Token ופרטי משתמש', async () => {
      const response = await request(app.getHttpServer())
        .post(api('/auth/login'))
        .send({ email: 'commander@test.demo', password: TEST_PASSWORD })
        .expect(200);

      expect(response.body.accessToken).toBeTruthy();
      expect(response.body.user.role).toBe('LOGISTICS_COMMANDER');
      expect(response.body.user).not.toHaveProperty('passwordHash');
      expect(response.headers['set-cookie']?.[0]).toContain('HttpOnly');
    });

    it('נכשלת בסיסמה שגויה עם אותה הודעה כמו משתמש לא קיים', async () => {
      const wrongPassword = await request(app.getHttpServer())
        .post(api('/auth/login'))
        .send({ email: 'commander@test.demo', password: 'WrongPassword1' })
        .expect(401);

      const unknownUser = await request(app.getHttpServer())
        .post(api('/auth/login'))
        .send({ email: 'nobody@test.demo', password: 'WrongPassword1' })
        .expect(401);

      expect(wrongPassword.body.message).toBe(unknownUser.body.message);
      expect(wrongPassword.body.code).toBe('INVALID_CREDENTIALS');
    });

    it('דוחה גישה ללא Token', async () => {
      const response = await request(app.getHttpServer()).get(api('/packages')).expect(401);
      expect(response.body.code).toBe('NOT_AUTHENTICATED');
      expect(response.body.message).not.toMatch(/401/);
    });

    it('דוחה שדות שאינם בסכמה', async () => {
      const response = await request(app.getHttpServer())
        .post(api('/auth/login'))
        .send({ email: 'commander@test.demo', password: TEST_PASSWORD, role: 'ADMIN' })
        .expect(400);
      expect(response.body.code).toBe('VALIDATION_FAILED');
    });
  });

  // ============================================================
  // הזרימה המרכזית
  // ============================================================

  describe('הזרימה המרכזית: משימה, אריזה, שליחות, קליטה ופיזור', () => {
    let taskId: string;
    let packageOneId: string;
    let packageTwoId: string;
    let missionId: string;
    let publicToken: string;

    it('מפקד יוצר משימת אריזה עם פריט ייחודי וציוד כמותי', async () => {
      const response = await request(app.getHttpServer())
        .post(api('/packing-tasks'))
        .set(auth(commanderToken))
        .send({
          sourceRoomId: fixtures.sourceRoomGdnId,
          destinationRoomId: fixtures.destinationRoomId,
          teamId: fixtures.teamDevId,
          assignedSoldierId: fixtures.soldierGdnId,
          priority: 'HIGH',
          notes: 'פינוי עמדות',
          lines: [
            {
              productCatalogItemId: fixtures.laptopProductId,
              assetInstanceId: fixtures.laptopAssetId,
              requestedQuantity: 1,
            },
            {
              productCatalogItemId: fixtures.monitorProductId,
              assetInstanceId: fixtures.monitorAssetId,
              requestedQuantity: 1,
            },
            { productCatalogItemId: fixtures.mouseProductId, requestedQuantity: 4 },
          ],
        })
        .expect(201);

      taskId = response.body.id;
      expect(response.body.taskNumber).toMatch(/^TSK-\d{5}$/);
      expect(response.body.status).toBe('ASSIGNED');
      expect(response.body.progress.totalUnits).toBe(6);

      const inventory = await database.prisma.roomInventory.findFirst({
        where: { roomId: fixtures.sourceRoomGdnId, productCatalogItemId: fixtures.mouseProductId },
      });
      expect(inventory?.reservedQuantity).toBe(4);

      const asset = await database.prisma.assetInstance.findUnique({
        where: { id: fixtures.laptopAssetId },
      });
      expect(asset?.status).toBe('RESERVED_FOR_TASK');
    });

    it('חייל אינו יכול ליצור משימה', async () => {
      const response = await request(app.getHttpServer())
        .post(api('/packing-tasks'))
        .set(auth(soldierGdnToken))
        .send({
          sourceRoomId: fixtures.sourceRoomGdnId,
          destinationRoomId: fixtures.destinationRoomId,
          teamId: fixtures.teamDevId,
          assignedSoldierId: fixtures.soldierGdnId,
          lines: [{ productCatalogItemId: fixtures.mouseProductId, requestedQuantity: 1 }],
        })
        .expect(403);
      expect(response.body.code).toBe('FORBIDDEN_ROLE');
    });

    it('חייל אחר אינו רואה את המשימה (IDOR)', async () => {
      const response = await request(app.getHttpServer())
        .get(api(`/packing-tasks/${taskId}`))
        .set(auth(soldierTzrToken))
        .expect(403);
      expect(response.body.code).toBe('FORBIDDEN_TASK_SCOPE');
      expect(response.body.message).toContain('אינה משויכת אליך');
    });

    it('החייל מתחיל את המשימה ויוצר אריזה ראשונה', async () => {
      await request(app.getHttpServer())
        .post(api(`/packing-tasks/${taskId}/start`))
        .set(auth(soldierGdnToken))
        .expect(200);

      const response = await request(app.getHttpServer())
        .post(api(`/packing-tasks/${taskId}/packages`))
        .set(auth(soldierGdnToken))
        .send({ packageType: 'PROFESSIONAL_BOX' })
        .expect(201);

      packageOneId = response.body.id;
      publicToken = '';
      expect(response.body.packageNumber).toMatch(/^PKG-\d{5}$/);
      expect(response.body.status).toBe('OPEN');
      expect(response.body).not.toHaveProperty('publicToken');
    });

    it('מוסיף מחשב לפי המזהה שעל המדבקה, ומסך, ועכברים', async () => {
      const afterLaptop = await request(app.getHttpServer())
        .post(api(`/packages/${packageOneId}/assets`))
        .set(auth(soldierGdnToken))
        .send({ assetTag: fixtures.laptopAssetTag })
        .expect(201);
      expect(afterLaptop.body.assets).toHaveLength(1);
      expect(afterLaptop.body.assets[0].ownerName).toBe('רועי לוי');

      await request(app.getHttpServer())
        .post(api(`/packages/${packageOneId}/assets`))
        .set(auth(soldierGdnToken))
        .send({ assetInstanceId: fixtures.monitorAssetId })
        .expect(201);

      const afterBulk = await request(app.getHttpServer())
        .post(api(`/packages/${packageOneId}/bulk-lines`))
        .set(auth(soldierGdnToken))
        .send({ productCatalogItemId: fixtures.mouseProductId, quantity: 3 })
        .expect(201);

      expect(afterBulk.body.totalUnits).toBe(5);

      const inventory = await database.prisma.roomInventory.findFirst({
        where: { roomId: fixtures.sourceRoomGdnId, productCatalogItemId: fixtures.mouseProductId },
      });
      expect(inventory?.reservedQuantity).toBe(1);
      expect(inventory?.packedQuantity).toBe(3);
    });

    it('מונע אריזה כפולה של אותו פריט ייחודי', async () => {
      const response = await request(app.getHttpServer())
        .post(api(`/packages/${packageOneId}/assets`))
        .set(auth(soldierGdnToken))
        .send({ assetTag: fixtures.laptopAssetTag })
        .expect(409);
      expect(['ASSET_ALREADY_PACKED', 'DUPLICATE_BUSINESS_KEY']).toContain(response.body.code);
    });

    it('מונע חריגה מהכמות שהוגדרה במשימה', async () => {
      const response = await request(app.getHttpServer())
        .post(api(`/packages/${packageOneId}/bulk-lines`))
        .set(auth(soldierGdnToken))
        .send({ productCatalogItemId: fixtures.mouseProductId, quantity: 5 })
        .expect(409);
      expect(response.body.code).toBe('QUANTITY_EXCEEDS_TASK');
    });

    it('סוגר את האריזה ומקבל תווית עם QR שמכיל Token אקראי בלבד', async () => {
      const sealed = await request(app.getHttpServer())
        .post(api(`/packages/${packageOneId}/seal`))
        .set(auth(soldierGdnToken))
        .expect(200);

      expect(sealed.body.status).toBe('READY_FOR_SHIPMENT');
      expect(sealed.body.timeline.map((event: { toStatus: string }) => event.toStatus)).toEqual([
        'OPEN',
        'SEALED',
        'READY_FOR_SHIPMENT',
      ]);

      const label = await request(app.getHttpServer())
        .get(api(`/packages/${packageOneId}/label`))
        .set(auth(soldierGdnToken))
        .expect(200);

      expect(label.body.qrUrl).toContain('/scan/package/');
      expect(label.body.qrUrl).not.toContain(label.body.packageNumber);
      expect(label.body.qrUrl).not.toContain('רועי');
      expect(label.body.destination.roomNumber).toBe('201');

      publicToken = label.body.qrUrl.split('/scan/package/')[1];
      expect(publicToken.length).toBeGreaterThanOrEqual(32);
    });

    it('אריזה שנייה משלימה את שאר תכולת המשימה ומסיימת אותה', async () => {
      const created = await request(app.getHttpServer())
        .post(api(`/packing-tasks/${taskId}/packages`))
        .set(auth(soldierGdnToken))
        .send({ packageType: 'PERSONAL_BOX' })
        .expect(201);
      packageTwoId = created.body.id;

      await request(app.getHttpServer())
        .post(api(`/packages/${packageTwoId}/bulk-lines`))
        .set(auth(soldierGdnToken))
        .send({ productCatalogItemId: fixtures.mouseProductId, quantity: 1 })
        .expect(201);

      await request(app.getHttpServer())
        .post(api(`/packages/${packageTwoId}/seal`))
        .set(auth(soldierGdnToken))
        .expect(200);

      const task = await request(app.getHttpServer())
        .get(api(`/packing-tasks/${taskId}`))
        .set(auth(soldierGdnToken))
        .expect(200);

      expect(task.body.status).toBe('COMPLETED');
      expect(task.body.progress.percent).toBe(100);
    });

    it('פתיחה מחדש ועריכה לפני היציאה', async () => {
      const reopened = await request(app.getHttpServer())
        .post(api(`/packages/${packageTwoId}/reopen`))
        .set(auth(soldierGdnToken))
        .send({ reason: 'תיקון כמות' })
        .expect(200);
      expect(reopened.body.status).toBe('OPEN');

      const lineId = reopened.body.bulkLines[0].id;
      await request(app.getHttpServer())
        .delete(api(`/packages/${packageTwoId}/bulk-lines/${lineId}`))
        .set(auth(soldierGdnToken))
        .expect(200);

      await request(app.getHttpServer())
        .post(api(`/packages/${packageTwoId}/bulk-lines`))
        .set(auth(soldierGdnToken))
        .send({ productCatalogItemId: fixtures.mouseProductId, quantity: 1 })
        .expect(201);

      const resealed = await request(app.getHttpServer())
        .post(api(`/packages/${packageTwoId}/seal`))
        .set(auth(soldierGdnToken))
        .expect(200);
      expect(resealed.body.status).toBe('READY_FOR_SHIPMENT');
    });

    it('מפקד מקבל הצעת מסלול עם הסבר', async () => {
      // אריזה נוספת מבסיס אחר, כדי שהמסלול יכלול שני בסיסי איסוף.
      const tzrTask = await request(app.getHttpServer())
        .post(api('/packing-tasks'))
        .set(auth(commanderToken))
        .send({
          sourceRoomId: fixtures.sourceRoomTzrId,
          destinationRoomId: fixtures.destinationRoomId,
          teamId: fixtures.teamOtherId,
          assignedSoldierId: fixtures.soldierTzrId,
          priority: 'URGENT',
          lines: [
            {
              productCatalogItemId: fixtures.laptopProductId,
              assetInstanceId: fixtures.tzrAssetId,
              requestedQuantity: 1,
            },
          ],
        })
        .expect(201);

      const tzrPackage = await request(app.getHttpServer())
        .post(api(`/packing-tasks/${tzrTask.body.id}/packages`))
        .set(auth(soldierTzrToken))
        .send({ packageType: 'CRATE' })
        .expect(201);

      await request(app.getHttpServer())
        .post(api(`/packages/${tzrPackage.body.id}/assets`))
        .set(auth(soldierTzrToken))
        .send({ assetInstanceId: fixtures.tzrAssetId })
        .expect(201);

      await request(app.getHttpServer())
        .post(api(`/packages/${tzrPackage.body.id}/seal`))
        .set(auth(soldierTzrToken))
        .expect(200);

      const suggestion = await request(app.getHttpServer())
        .post(api('/missions/route-suggestions'))
        .set(auth(commanderToken))
        .send({ packageIds: [packageOneId, packageTwoId, tzrPackage.body.id] })
        .expect(200);

      expect(suggestion.body.stops[0].stopType).toBe('START');
      expect(suggestion.body.stops.at(-1).stopType).toBe('DELIVERY_HUB');
      expect(suggestion.body.totalDistanceKm).toBeGreaterThan(0);
      expect(suggestion.body.explanation.length).toBeGreaterThan(1);
      expect(suggestion.body.estimatedTripsSaved).toBe(1);
    });

    it('מפקד יוצר שליחות מרובת בסיסים עם נסיעה מאובטחת', async () => {
      const response = await request(app.getHttpServer())
        .post(api('/missions'))
        .set(auth(commanderToken))
        .send({
          title: 'איסוף מגדעונים',
          plannedDepartureAt: new Date(Date.now() + 86_400_000).toISOString(),
          vehicleType: 'TRUCK',
          licensePlate: '12-345-67',
          assignedSoldierId: fixtures.soldierGdnId,
          requiresSecuredTransport: true,
          securedTransportNotes: 'ליווי לפי נוהל',
          packageIds: [packageOneId, packageTwoId],
        })
        .expect(201);

      missionId = response.body.id;
      expect(response.body.status).toBe('PLANNED');
      expect(response.body.missionNumber).toMatch(/^SHP-\d{5}$/);
      expect(response.body.securedTransportNotes).toBe('ליווי לפי נוהל');
      expect(response.body.stops.length).toBeGreaterThanOrEqual(3);

      const pkg = await request(app.getHttpServer())
        .get(api(`/packages/${packageOneId}`))
        .set(auth(commanderToken))
        .expect(200);
      expect(pkg.body.status).toBe('ASSIGNED_TO_MISSION');
    });

    it('מסתיר את הנחיות הנסיעה המאובטחת ממשתמש שאינו מורשה', async () => {
      const response = await request(app.getHttpServer())
        .get(api(`/missions/${missionId}`))
        .set(auth(soldierTzrToken));

      if (response.status === 200) {
        expect(response.body.securedTransportNotes).toBeNull();
      } else {
        expect(response.status).toBe(403);
      }
    });

    it('חייל מבסיס אחר מבקש להוסיף עצירה, והמפקד מאשר', async () => {
      const tzrTask = await request(app.getHttpServer())
        .post(api('/packing-tasks'))
        .set(auth(commanderToken))
        .send({
          sourceRoomId: fixtures.sourceRoomTzrId,
          destinationRoomId: fixtures.destinationRoomId,
          teamId: fixtures.teamOtherId,
          assignedSoldierId: fixtures.soldierTzrId,
          lines: [{ productCatalogItemId: fixtures.mouseProductId, requestedQuantity: 2 }],
        })
        .expect(201);

      const extraPackage = await request(app.getHttpServer())
        .post(api(`/packing-tasks/${tzrTask.body.id}/packages`))
        .set(auth(soldierTzrToken))
        .send({ packageType: 'BULK_CONTAINER' })
        .expect(201);

      await request(app.getHttpServer())
        .post(api(`/packages/${extraPackage.body.id}/bulk-lines`))
        .set(auth(soldierTzrToken))
        .send({ productCatalogItemId: fixtures.mouseProductId, quantity: 2 })
        .expect(201);

      await request(app.getHttpServer())
        .post(api(`/packages/${extraPackage.body.id}/seal`))
        .set(auth(soldierTzrToken))
        .expect(200);

      const joinRequest = await request(app.getHttpServer())
        .post(api(`/missions/${missionId}/join-requests`))
        .set(auth(soldierTzrToken))
        .send({ packageIds: [extraPackage.body.id], note: 'יש אריזה מוכנה בצריפין' })
        .expect(201);

      expect(joinRequest.body.status).toBe('PENDING');

      const approved = await request(app.getHttpServer())
        .post(api(`/mission-join-requests/${joinRequest.body.id}/approve`))
        .set(auth(commanderToken))
        .send({})
        .expect(200);
      expect(approved.body.status).toBe('APPROVED');

      const mission = await request(app.getHttpServer())
        .get(api(`/missions/${missionId}`))
        .set(auth(commanderToken))
        .expect(200);

      const pickupBases = mission.body.stops
        .filter((stop: { stopType: string }) => stop.stopType === 'PICKUP')
        .map((stop: { baseId: string }) => stop.baseId);
      expect(new Set(pickupBases).size).toBe(2);
      expect(mission.body.packages).toHaveLength(3);
    });

    it('חייל אינו יכול לאשר בקשת הצטרפות', async () => {
      const requests = await request(app.getHttpServer())
        .get(api('/mission-join-requests'))
        .set(auth(commanderToken))
        .expect(200);

      const anyRequestId = requests.body.items[0]?.id;
      if (!anyRequestId) return;

      const response = await request(app.getHttpServer())
        .post(api(`/mission-join-requests/${anyRequestId}/approve`))
        .set(auth(soldierTzrToken))
        .send({})
        .expect(403);
      expect(response.body.code).toBe('FORBIDDEN_ROLE');
    });

    it('העמסה: הגעה לעצירה, סימון אריזות ויציאה לדרך', async () => {
      await request(app.getHttpServer())
        .post(api(`/missions/${missionId}/start-loading`))
        .set(auth(soldierGdnToken))
        .expect(200);

      const mission = await request(app.getHttpServer())
        .get(api(`/missions/${missionId}`))
        .set(auth(soldierGdnToken))
        .expect(200);

      const pickupStops = mission.body.stops.filter(
        (stop: { stopType: string }) => stop.stopType === 'PICKUP',
      );

      for (const stop of pickupStops) {
        await request(app.getHttpServer())
          .post(api(`/missions/${missionId}/stops/${stop.id}/arrive`))
          .set(auth(soldierGdnToken))
          .expect(200);

        for (const item of stop.packages) {
          await request(app.getHttpServer())
            .post(api(`/missions/${missionId}/packages/${item.packageId}/load`))
            .set(auth(soldierGdnToken))
            .send({ idempotencyKey: `load-${item.packageId}` })
            .expect(200);
        }
      }

      // סריקה חוזרת של אותה אריזה לא תיצור העמסה כפולה.
      const duplicate = await request(app.getHttpServer())
        .post(api(`/missions/${missionId}/packages/${packageOneId}/load`))
        .set(auth(soldierGdnToken))
        .send({ idempotencyKey: `load-${packageOneId}` })
        .expect(409);
      expect(duplicate.body.code).toBe('PACKAGE_ALREADY_LOADED');

      const departed = await request(app.getHttpServer())
        .post(api(`/missions/${missionId}/depart`))
        .set(auth(soldierGdnToken))
        .expect(200);

      expect(departed.body.status).toBe('IN_TRANSIT');
      expect(
        departed.body.packages.every((item: { status: string }) => item.status === 'IN_TRANSIT'),
      ).toBe(true);
    });

    it('ניסיון לשנות אריזה אחרי היציאה נכשל ב-409 עם הודעה בעברית', async () => {
      const response = await request(app.getHttpServer())
        .post(api(`/packages/${packageOneId}/bulk-lines`))
        .set(auth(soldierGdnToken))
        .send({ productCatalogItemId: fixtures.mouseProductId, quantity: 1 })
        .expect(409);

      expect(response.body.code).toBe('PACKAGE_LOCKED');
      expect(response.body.message).toBe('לא ניתן לערוך אריזה לאחר שהשליחות יצאה לדרך');

      const reopen = await request(app.getHttpServer())
        .post(api(`/packages/${packageOneId}/reopen`))
        .set(auth(soldierGdnToken))
        .send({})
        .expect(409);
      expect(reopen.body.code).toBe('PACKAGE_LOCKED');
    });

    it('סריקת QR דורשת התחברות, ומחזירה למורשה את היעד והפעולה', async () => {
      await request(app.getHttpServer()).get(api(`/scan/packages/${publicToken}`)).expect(401);

      const scan = await request(app.getHttpServer())
        .get(api(`/scan/packages/${publicToken}`))
        .set(auth(soldierHubToken))
        .expect(200);

      expect(scan.body.package.destination.roomNumber).toBe('201');
      expect(scan.body.suggestedAction).toBe('RECEIVE');
      expect(scan.body.suggestedActionLabel).toContain('קליטה');
    });

    it('סריקה עם Token שאינו קיים מחזירה הודעה ידידותית', async () => {
      const response = await request(app.getHttpServer())
        .get(api(`/scan/packages/${'z'.repeat(40)}`))
        .set(auth(soldierHubToken))
        .expect(404);
      expect(response.body.code).toBe('PACKAGE_TOKEN_NOT_FOUND');
      expect(response.body.message).not.toMatch(/404/);
    });

    it('קליטה בקריית התקשוב ופיזור לחדר היעד', async () => {
      const received = await request(app.getHttpServer())
        .post(api(`/packages/${packageOneId}/receive`))
        .set(auth(soldierHubToken))
        .send({ idempotencyKey: `receive-${packageOneId}` })
        .expect(200);
      expect(received.body.status).toBe('RECEIVED_AT_HUB');

      // סריקה חוזרת אינה יוצרת קליטה נוספת.
      const duplicate = await request(app.getHttpServer())
        .post(api(`/packages/${packageOneId}/receive`))
        .set(auth(soldierHubToken))
        .send({ idempotencyKey: `receive-${packageOneId}` })
        .expect(409);
      expect(duplicate.body.code).toBe('PACKAGE_ALREADY_RECEIVED');

      const delivered = await request(app.getHttpServer())
        .post(api(`/packages/${packageOneId}/deliver`))
        .set(auth(soldierHubToken))
        .send({ idempotencyKey: `deliver-${packageOneId}` })
        .expect(200);

      expect(delivered.body.status).toBe('DELIVERED_TO_ROOM');
      expect(delivered.body.timeline.at(-1).toStatus).toBe('DELIVERED_TO_ROOM');

      const laptop = await database.prisma.assetInstance.findUnique({
        where: { id: fixtures.laptopAssetId },
      });
      expect(laptop?.status).toBe('DELIVERED');
      expect(laptop?.currentRoomId).toBe(fixtures.destinationRoomId);

      const destinationInventory = await database.prisma.roomInventory.findFirst({
        where: {
          roomId: fixtures.destinationRoomId,
          productCatalogItemId: fixtures.mouseProductId,
        },
      });
      expect(destinationInventory?.deliveredQuantity).toBe(3);
    });

    it('פיזור לפני קליטה נכשל', async () => {
      const response = await request(app.getHttpServer())
        .post(api(`/packages/${packageTwoId}/deliver`))
        .set(auth(soldierHubToken))
        .send({})
        .expect(409);
      expect(response.body.code).toBe('PACKAGE_NOT_RECEIVED');
    });
  });

  // ============================================================
  // הרשאות ראש צוות
  // ============================================================

  describe('ראש צוות', () => {
    it('רואה רק את האריזות של הצוות שלו', async () => {
      const response = await request(app.getHttpServer())
        .get(api('/packages'))
        .set(auth(teamLeadToken))
        .expect(200);

      expect(response.body.items.length).toBeGreaterThan(0);
      expect(
        response.body.items.every(
          (item: { teamId: string }) => item.teamId === fixtures.teamDevId,
        ),
      ).toBe(true);
    });

    it('אינו יכול לצפות באריזה של צוות אחר גם בגישה ישירה למזהה', async () => {
      const commanderView = await request(app.getHttpServer())
        .get(api('/packages'))
        .set(auth(commanderToken))
        .expect(200);

      const otherTeamPackage = commanderView.body.items.find(
        (item: { teamId: string }) => item.teamId === fixtures.teamOtherId,
      );
      expect(otherTeamPackage).toBeDefined();

      const response = await request(app.getHttpServer())
        .get(api(`/packages/${otherTeamPackage.id}`))
        .set(auth(teamLeadToken))
        .expect(403);

      expect(response.body.code).toBe('FORBIDDEN_PACKAGE_SCOPE');
      expect(response.body.message).toBe('אין לך הרשאה לצפות באריזה הזו');
    });

    it('רואה את המזהה והבעלים של מחשבים ומסכים באריזה של הצוות', async () => {
      const list = await request(app.getHttpServer())
        .get(api('/packages'))
        .set(auth(teamLeadToken))
        .expect(200);

      const withAssets = list.body.items.find((item: { totalUnits: number }) => item.totalUnits > 1);
      const detail = await request(app.getHttpServer())
        .get(api(`/packages/${withAssets.id}`))
        .set(auth(teamLeadToken))
        .expect(200);

      expect(detail.body.assets[0]).toMatchObject({
        assetTag: 'LT-0001',
        ownerName: 'רועי לוי',
      });
      expect(detail.body.permissions.canEditContent).toBe(false);
    });

    it('אינו רשאי לגשת לשליחויות או ליומן הפעולות', async () => {
      await request(app.getHttpServer())
        .get(api('/missions'))
        .set(auth(teamLeadToken))
        .expect(403);

      await request(app.getHttpServer())
        .get(api('/audit-logs'))
        .set(auth(otherTeamLeadToken))
        .expect(403);
    });
  });

  // ============================================================
  // Dashboard, מפה ו-Audit
  // ============================================================

  describe('תמונת מצב ותיעוד', () => {
    it('Dashboard המפקד מציג נתונים אמיתיים מהמסד', async () => {
      const response = await request(app.getHttpServer())
        .get(api('/dashboard/commander'))
        .set(auth(commanderToken))
        .expect(200);

      expect(response.body.packages.total).toBeGreaterThan(0);
      expect(response.body.baseProgress.length).toBeGreaterThanOrEqual(3);
      expect(response.body.packages.byStatus).toHaveLength(7);
      expect(response.body.overallProgressPercent).toBeGreaterThanOrEqual(0);
    });

    it('Dashboard מפקד המבצע מחזיר תמונת מאקרו של בסיסים ויחידות', async () => {
      const response = await request(app.getHttpServer())
        .get(api('/dashboard/operation'))
        .set(auth(operationCommanderToken))
        .expect(200);

      expect(response.body.headline.packagesTotal).toBeGreaterThan(0);
      expect(Array.isArray(response.body.bases)).toBe(true);
      expect(response.body.bases.length).toBeGreaterThanOrEqual(3);
      // כל בסיס נושא חיווי ומערך יחידות, גם אם ריק.
      for (const base of response.body.bases) {
        expect(['GREEN', 'AMBER', 'RED']).toContain(base.health);
        expect(Array.isArray(base.units)).toBe(true);
      }
      expect(response.body).toHaveProperty('generatedAt');
    });

    it('Dashboard המאקרו חסום לכל תפקיד אחר', async () => {
      for (const token of [commanderToken, soldierGdnToken, teamLeadToken]) {
        await request(app.getHttpServer())
          .get(api('/dashboard/operation'))
          .set(auth(token))
          .expect(403);
      }
    });

    it('מפקד המבצע חסום מנתיבי כתיבה על אריזות', async () => {
      await request(app.getHttpServer())
        .get(api('/dashboard/commander'))
        .set(auth(operationCommanderToken))
        .expect(403);
    });

    it('Dashboard החייל מחזיר את המשימות שלו בלבד', async () => {
      const response = await request(app.getHttpServer())
        .get(api('/dashboard/soldier'))
        .set(auth(soldierGdnToken))
        .expect(200);
      expect(response.body).toHaveProperty('activeTasks');
      expect(response.body).toHaveProperty('myMissions');
    });

    it('מפת הקומה מחזירה חדרים עם סיכום ציוד ומצב', async () => {
      const maps = await request(app.getHttpServer())
        .get(api('/floor-maps'))
        .set(auth(commanderToken))
        .expect(200);

      const floor = await request(app.getHttpServer())
        .get(api(`/floor-maps/${maps.body[0].id}`))
        .set(auth(commanderToken))
        .expect(200);

      expect(floor.body.rooms[0]).toMatchObject({ roomNumber: '201' });
      expect(floor.body.rooms[0].state).toBe('ARRIVED');
      expect(floor.body.corridor.width).toBe(960);
    });

    it('יומן הפעולות מתעד את הפעולות המשמעותיות ואינו חושף סודות', async () => {
      const response = await request(app.getHttpServer())
        .get(api('/audit-logs'))
        .query({ pageSize: 100 })
        .set(auth(commanderToken))
        .expect(200);

      const actions = response.body.items.map((item: { action: string }) => item.action);
      expect(actions).toContain('LOGIN_SUCCESS');
      expect(actions).toContain('TASK_CREATED');
      expect(actions).toContain('PACKAGE_SEALED');
      expect(actions).toContain('MISSION_DEPARTED');
      expect(actions).toContain('PACKAGE_DELIVERED');

      const serialized = JSON.stringify(response.body);
      expect(serialized).not.toContain(TEST_PASSWORD);
      expect(serialized).not.toContain('passwordHash');
    });

    it('בדיקת החיות מחזירה מצב מסד נתונים', async () => {
      const response = await request(app.getHttpServer()).get(api('/health')).expect(200);
      expect(response.body.status).toBe('ok');
      expect(response.body.database).toBe('up');
    });
  });
});
