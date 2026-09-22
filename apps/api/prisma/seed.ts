/**
 * Seed של מערכת המעבר דרומה.
 *
 * מייצר מיפוי מלא (כאילו נקלט מקובץ Excel של שלב א׳), משתמשי דמו לכל תפקיד,
 * ותרחיש עסקי חי: משימות, אריזות ושליחויות במצבים שונים - כדי שה-Dashboard,
 * המפה וציר הזמן לא יהיו ריקים.
 *
 * כל הנתונים סינתטיים. אין כאן מידע מבצעי אמיתי.
 */
import { hash } from '@node-rs/argon2';
import { PrismaClient } from '@prisma/client';
import {
  DEFAULT_DEMO_PASSWORD,
  FLOOR_MAP_CANVAS,
  FLOOR_MAP_LAYOUT,
  HUB_BUILDING_NAME,
  ID_PREFIX,
  formatFriendlyId,
} from '@south/shared';
import { randomBytes } from 'node:crypto';
import { BASES, CATALOG, DEMO_USERS, HUB_FLOOR_PLAN, OWNERS, SOURCE_ROOMS, TEAMS, UNITS } from './seed-data';

/**
 * ה-Seed מקבל את לקוח Prisma מבחוץ, כדי שניתן יהיה להריץ אותו גם בבדיקות
 * מול מסד נתונים בתוך התהליך, ולא רק מול Supabase.
 */
let prisma: PrismaClient;

/** מחולל פסאודו-אקראי דטרמיניסטי, כדי שה-Seed יהיה זהה בכל הרצה. */
function createRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}
const random = createRandom(20260101);
const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)];
const between = (min: number, max: number): number => min + Math.floor(random() * (max - min + 1));

const token = (): string => randomBytes(32).toString('base64url');
const hoursAgo = (hours: number): Date => new Date(Date.now() - hours * 3_600_000);
const hoursFromNow = (hours: number): Date => new Date(Date.now() + hours * 3_600_000);

async function resolveDemoPassword(): Promise<{ password: string; generated: boolean }> {
  const fromEnv = process.env.SEED_DEMO_PASSWORD;
  if (fromEnv && fromEnv.length >= 8) return { password: fromEnv, generated: false };

  if (process.env.NODE_ENV === 'production') {
    // NoCyberHere: SECRET_MANAGEMENT
    // Threat: סיסמת דמו קבועה וידועה בסביבת פרודקשן
    // Reason: בפרודקשן חובה לספק סיסמה דרך הסביבה, או שתיווצר אקראית ותוצג פעם אחת.
    return { password: randomBytes(12).toString('base64url'), generated: true };
  }
  return { password: DEFAULT_DEMO_PASSWORD, generated: false };
}

async function wipe(): Promise<void> {
  // סדר מחיקה לפי תלויות המפתחות הזרים.
  await prisma.$transaction([
    prisma.idempotencyRecord.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.packageStatusEvent.deleteMany(),
    prisma.missionJoinRequestPackage.deleteMany(),
    prisma.missionJoinRequest.deleteMany(),
    prisma.missionPackage.deleteMany(),
    prisma.missionStop.deleteMany(),
    prisma.transportMission.deleteMany(),
    prisma.packageAsset.deleteMany(),
    prisma.packageBulkLine.deleteMany(),
    prisma.package.deleteMany(),
    prisma.packingTaskLine.deleteMany(),
    prisma.packingTask.deleteMany(),
    prisma.assetInstance.deleteMany(),
    prisma.roomInventory.deleteMany(),
    prisma.productCatalogItem.deleteMany(),
    prisma.roomMapShape.deleteMany(),
    prisma.room.deleteMany(),
    prisma.floorMap.deleteMany(),
    prisma.refreshSession.deleteMany(),
  ]);
  // Team.leadUserId ו-User.teamId מצביעים זה על זה, ולכן מנתקים לפני המחיקה.
  await prisma.team.updateMany({ data: { leadUserId: null } });
  await prisma.user.updateMany({ data: { teamId: null } });
  await prisma.team.deleteMany();
  await prisma.organizationalUnit.deleteMany();
  await prisma.user.deleteMany();
  await prisma.base.deleteMany();
}

async function ensureSequences(): Promise<void> {
  // הרצפים נוצרים ב-migration; כאן רק מוודאים קיום למקרה של סכמה שנוצרה בדרך אחרת.
  await prisma.$executeRawUnsafe(
    "CREATE SEQUENCE IF NOT EXISTS package_number_seq START WITH 10001 INCREMENT BY 1",
  );
  await prisma.$executeRawUnsafe(
    "CREATE SEQUENCE IF NOT EXISTS task_number_seq START WITH 101 INCREMENT BY 1",
  );
  await prisma.$executeRawUnsafe(
    "CREATE SEQUENCE IF NOT EXISTS mission_number_seq START WITH 21 INCREMENT BY 1",
  );
}

async function syncSequences(values: {
  lastTask: number;
  lastPackage: number;
  lastMission: number;
}): Promise<void> {
  await prisma.$executeRaw`SELECT setval('task_number_seq', ${values.lastTask}, true)`;
  await prisma.$executeRaw`SELECT setval('package_number_seq', ${values.lastPackage}, true)`;
  await prisma.$executeRaw`SELECT setval('mission_number_seq', ${values.lastMission}, true)`;
}

export async function runSeed(client: PrismaClient): Promise<void> {
  prisma = client;
  const { password, generated } = await resolveDemoPassword();
  const passwordHash = await hash(password);

  console.log('מנקה נתונים קיימים...');
  await ensureSequences();
  await wipe();

  // ---------- בסיסים, יחידות, צוותים ----------
  console.log('יוצר בסיסים, יחידות וצוותים...');
  const baseByCode = new Map<string, string>();
  for (const base of BASES) {
    const created = await prisma.base.create({ data: { ...base } });
    baseByCode.set(base.code, created.id);
  }

  const unitByCode = new Map<string, string>();
  for (const unit of UNITS) {
    const created = await prisma.organizationalUnit.create({
      data: {
        code: unit.code,
        name: unit.name,
        type: unit.type,
        baseId: baseByCode.get(unit.baseCode)!,
      },
    });
    unitByCode.set(unit.code, created.id);
  }

  const teamByCode = new Map<string, string>();
  for (const team of TEAMS) {
    const created = await prisma.team.create({
      data: { code: team.code, name: team.name, unitId: unitByCode.get(team.unitCode)! },
    });
    teamByCode.set(team.code, created.id);
  }

  // ---------- משתמשים ----------
  console.log('יוצר משתמשי דמו...');
  const userByEmail = new Map<string, string>();
  for (const user of DEMO_USERS) {
    const created = await prisma.user.create({
      data: {
        identityNumber: user.identityNumber,
        fullName: user.fullName,
        email: user.email,
        passwordHash,
        role: user.role,
        baseId: baseByCode.get(user.baseCode)!,
        teamId: user.teamCode ? teamByCode.get(user.teamCode)! : null,
      },
    });
    userByEmail.set(user.email, created.id);

    if (user.role === 'TEAM_LEAD' && user.teamCode) {
      await prisma.team.update({
        where: { id: teamByCode.get(user.teamCode)! },
        data: { leadUserId: created.id },
      });
    }
  }

  const commanderId = userByEmail.get('commander@south.demo')!;
  const soldierGdnId = userByEmail.get('soldier.gdn@south.demo')!;
  const soldierTzrId = userByEmail.get('soldier.tzr@south.demo')!;
  const soldierKtId = userByEmail.get('soldier.kt@south.demo')!;

  // ---------- קטלוג ----------
  console.log('יוצר קטלוג מוצרים...');
  const productBySku = new Map<string, { id: string; trackingMode: string; name: string }>();
  for (const item of CATALOG) {
    const created = await prisma.productCatalogItem.create({ data: { ...item } });
    productBySku.set(item.sku, {
      id: created.id,
      trackingMode: created.trackingMode,
      name: created.name,
    });
  }

  // ---------- מפת בניין היעד ----------
  console.log('יוצר מפת חמש קומות בקריית התקשוב...');
  const hubBaseId = baseByCode.get('KT')!;
  const hubRoomByNumber = new Map<string, string>();

  // צוותים שמוצמדים לחדרי היעד, כדי שלחיצה על חדר תציג צוות אמיתי.
  const hubRoomTeams: Record<string, string> = {
    '101': 'KT-LOGT',
    '102': 'LOG-GDN',
    '103': 'NET',
    '104': 'KT-LOGT',
    '201': 'DEV-A',
    '202': 'DEV-B',
    '203': 'CYBER',
    '204': 'SUPPORT',
    '205': 'INTEG',
    '206': 'PLAN',
    '207': 'DEV-A',
    '304': 'NOC',
    '305': 'SUPPORT',
    '306': 'INTEG',
    '402': 'KT-LOGT',
    '404': 'HR',
    '406': 'FIN',
    '403': 'PLAN',
    '505': 'LAB',
    '508': 'LAB',
  };

  for (const floor of HUB_FLOOR_PLAN) {
    const floorMap = await prisma.floorMap.create({
      data: {
        baseId: hubBaseId,
        building: HUB_BUILDING_NAME,
        floorNumber: floor.floorNumber,
        displayName: floor.displayName,
        canvasWidth: FLOOR_MAP_CANVAS.width,
        canvasHeight: FLOOR_MAP_CANVAS.height,
      },
    });

    const place = async (
      room: { roomNumber: string; name: string },
      index: number,
      side: 'north' | 'south',
    ) => {
      const teamCode = hubRoomTeams[room.roomNumber];
      const created = await prisma.room.create({
        data: {
          baseId: hubBaseId,
          unitId: unitByCode.get('KT-HQ')!,
          teamId: teamCode ? teamByCode.get(teamCode)! : null,
          building: HUB_BUILDING_NAME,
          floor: String(floor.floorNumber),
          roomNumber: room.roomNumber,
          displayName: room.name,
          floorMapId: floorMap.id,
          mappingStatus: 'MAPPED',
        },
      });
      hubRoomByNumber.set(room.roomNumber, created.id);

      await prisma.roomMapShape.create({
        data: {
          floorMapId: floorMap.id,
          roomId: created.id,
          x: FLOOR_MAP_LAYOUT.columnsX[index],
          y: side === 'north' ? FLOOR_MAP_LAYOUT.northY : FLOOR_MAP_LAYOUT.southY,
          width: FLOOR_MAP_LAYOUT.room.width,
          height: FLOOR_MAP_LAYOUT.room.height,
          doorSide: side === 'north' ? 'SOUTH' : 'NORTH',
          zone: side === 'north' ? 'אגף צפוני' : 'אגף דרומי',
        },
      });
    };

    for (const [index, room] of floor.north.entries()) await place(room, index, 'north');
    for (const [index, room] of floor.south.entries()) await place(room, index, 'south');
  }

  // ---------- חדרי מקור ----------
  console.log('יוצר חדרי מקור בבסיסים המפונים...');
  const sourceRoomByKey = new Map<string, string>();
  for (const room of SOURCE_ROOMS) {
    const created = await prisma.room.create({
      data: {
        baseId: baseByCode.get(room.baseCode)!,
        unitId: unitByCode.get(room.unitCode)!,
        teamId: teamByCode.get(room.teamCode)!,
        building: room.building,
        floor: room.floor,
        roomNumber: room.roomNumber,
        displayName: room.displayName,
        mappingStatus: 'MAPPED',
      },
    });
    sourceRoomByKey.set(`${room.baseCode}:${room.roomNumber}`, created.id);
  }

  // ---------- מלאי ופריטים ----------
  console.log('יוצר מלאי, מחשבים ומסכים...');
  const bulkSkus = CATALOG.filter((item) => item.trackingMode === 'BULK').map((item) => item.sku);
  const serializedSkus = CATALOG.filter((item) => item.trackingMode === 'SERIALIZED').map(
    (item) => item.sku,
  );

  const inventoryKey = (roomId: string, sku: string) => `${roomId}:${sku}`;
  const inventoryIds = new Map<string, string>();

  async function addInventory(roomId: string, sku: string, mappedQuantity: number): Promise<void> {
    const product = productBySku.get(sku)!;
    const existing = inventoryIds.get(inventoryKey(roomId, sku));
    if (existing) {
      await prisma.roomInventory.update({
        where: { id: existing },
        data: { mappedQuantity: { increment: mappedQuantity } },
      });
      return;
    }
    const created = await prisma.roomInventory.create({
      data: { roomId, productCatalogItemId: product.id, mappedQuantity },
    });
    inventoryIds.set(inventoryKey(roomId, sku), created.id);
  }

  let assetCounter = 0;
  const assetsByRoom = new Map<string, Array<{ id: string; assetTag: string; sku: string }>>();

  async function addAsset(roomId: string, sku: string): Promise<{ id: string; assetTag: string }> {
    assetCounter += 1;
    const prefix = sku.startsWith('MN') ? 'MN' : sku.startsWith('DT') ? 'DT' : 'LT';
    const assetTag = `${prefix}-${String(assetCounter).padStart(4, '0')}`;
    const created = await prisma.assetInstance.create({
      data: {
        assetTag,
        productCatalogItemId: productBySku.get(sku)!.id,
        ownerName: pick(OWNERS),
        ownerIdentityNumber: String(between(1000000, 9999999)),
        currentRoomId: roomId,
        status: 'AVAILABLE',
      },
    });
    const list = assetsByRoom.get(roomId) ?? [];
    list.push({ id: created.id, assetTag, sku });
    assetsByRoom.set(roomId, list);
    return { id: created.id, assetTag };
  }

  // מלאי עשיר בחדרי המקור.
  for (const room of SOURCE_ROOMS) {
    const roomId = sourceRoomByKey.get(`${room.baseCode}:${room.roomNumber}`)!;
    for (const sku of bulkSkus) {
      if (random() < 0.55) await addInventory(roomId, sku, between(4, 30));
    }
    const assetCount = between(3, 7);
    for (let i = 0; i < assetCount; i += 1) {
      await addAsset(roomId, pick(serializedSkus));
    }
  }

  // ציוד קיים בחלק מחדרי היעד, כדי שהמפה תציג תוכן שונה בכל חדר.
  for (const [roomNumber, roomId] of hubRoomByNumber.entries()) {
    const floorDigit = Number(roomNumber[0]);
    if (random() < 0.25) continue; // חדרים ריקים - מדגימים את מצב "ללא ציוד" במקרא.

    for (const sku of bulkSkus) {
      if (random() < 0.3) await addInventory(roomId, sku, between(2, 14));
    }
    const assetCount = floorDigit <= 2 ? between(0, 3) : between(0, 2);
    for (let i = 0; i < assetCount; i += 1) {
      await addAsset(roomId, pick(serializedSkus));
    }
  }

  // ---------- תרחיש עסקי ----------
  console.log('יוצר משימות, אריזות ושליחויות...');

  let taskSeq = 100;
  let packageSeq = 10000;
  let missionSeq = 20;

  /** יוצר משימה ומבצע את השריונים בדיוק כמו שכבת ה-Domain. */
  async function createTask(spec: {
    sourceKey: string;
    destinationRoomNumber: string;
    teamCode: string;
    soldierId: string;
    priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
    status: 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED';
    createdHoursAgo: number;
    notes?: string;
    bulk: Array<{ sku: string; quantity: number }>;
    assetCount: number;
    assetSkuFilter?: (sku: string) => boolean;
  }) {
    const sourceRoomId = sourceRoomByKey.get(spec.sourceKey)!;
    const destinationRoomId = hubRoomByNumber.get(spec.destinationRoomNumber)!;
    taskSeq += 1;

    const roomAssets = (assetsByRoom.get(sourceRoomId) ?? []).filter(
      (asset) => !spec.assetSkuFilter || spec.assetSkuFilter(asset.sku),
    );
    const chosenAssets = roomAssets.slice(0, spec.assetCount);

    const task = await prisma.packingTask.create({
      data: {
        taskNumber: formatFriendlyId(ID_PREFIX.TASK, taskSeq),
        sourceRoomId,
        destinationRoomId,
        teamId: teamByCode.get(spec.teamCode)!,
        assignedSoldierId: spec.soldierId,
        createdById: commanderId,
        priority: spec.priority,
        status: spec.status,
        notes: spec.notes ?? null,
        createdAt: hoursAgo(spec.createdHoursAgo),
        startedAt: spec.status === 'ASSIGNED' ? null : hoursAgo(spec.createdHoursAgo - 1),
        dueAt: hoursFromNow(between(12, 72)),
      },
    });

    const lines: Array<{ id: string; sku: string; assetId?: string; requested: number }> = [];

    for (const asset of chosenAssets) {
      const line = await prisma.packingTaskLine.create({
        data: {
          packingTaskId: task.id,
          productCatalogItemId: productBySku.get(asset.sku)!.id,
          assetInstanceId: asset.id,
          requestedQuantity: 1,
        },
      });
      await prisma.assetInstance.update({
        where: { id: asset.id },
        data: { status: 'RESERVED_FOR_TASK', reservedForTaskId: task.id },
      });
      lines.push({ id: line.id, sku: asset.sku, assetId: asset.id, requested: 1 });
    }

    for (const bulk of spec.bulk) {
      await addInventory(sourceRoomId, bulk.sku, 0); // מוודא שקיימת שורת מלאי
      const inventoryId = inventoryIds.get(inventoryKey(sourceRoomId, bulk.sku));
      if (!inventoryId) {
        await addInventory(sourceRoomId, bulk.sku, bulk.quantity + between(2, 8));
      } else {
        const current = await prisma.roomInventory.findUnique({ where: { id: inventoryId } });
        const available =
          (current?.mappedQuantity ?? 0) -
          (current?.reservedQuantity ?? 0) -
          (current?.packedQuantity ?? 0);
        if (available < bulk.quantity) {
          await prisma.roomInventory.update({
            where: { id: inventoryId },
            data: { mappedQuantity: { increment: bulk.quantity - available } },
          });
        }
      }

      const line = await prisma.packingTaskLine.create({
        data: {
          packingTaskId: task.id,
          productCatalogItemId: productBySku.get(bulk.sku)!.id,
          requestedQuantity: bulk.quantity,
        },
      });
      await prisma.roomInventory.update({
        where: { id: inventoryIds.get(inventoryKey(sourceRoomId, bulk.sku))! },
        data: { reservedQuantity: { increment: bulk.quantity } },
      });
      lines.push({ id: line.id, sku: bulk.sku, requested: bulk.quantity });
    }

    return { task, lines, sourceRoomId, destinationRoomId, assets: chosenAssets };
  }

  /** יוצר אריזה עם תכולה ומעדכן מונים בדיוק כמו שכבת ה-Domain. */
  async function createPackage(spec: {
    task: { id: string; sourceRoomId: string; destinationRoomId: string; teamId: string };
    lines: Array<{ id: string; sku: string; assetId?: string; requested: number }>;
    contents: { assetIds: string[]; bulk: Array<{ sku: string; quantity: number }> };
    status:
      | 'OPEN'
      | 'READY_FOR_SHIPMENT'
      | 'ASSIGNED_TO_MISSION'
      | 'IN_TRANSIT'
      | 'RECEIVED_AT_HUB'
      | 'DELIVERED_TO_ROOM';
    packageType: 'PROFESSIONAL_BOX' | 'PERSONAL_BOX' | 'PALLET' | 'CRATE' | 'BULK_CONTAINER';
    createdHoursAgo: number;
    actorId: string;
  }) {
    packageSeq += 1;
    const sealed = spec.status !== 'OPEN';

    const pkg = await prisma.package.create({
      data: {
        packageNumber: formatFriendlyId(ID_PREFIX.PACKAGE, packageSeq),
        publicToken: token(),
        packingTaskId: spec.task.id,
        sourceRoomId: spec.task.sourceRoomId,
        destinationRoomId: spec.task.destinationRoomId,
        teamId: spec.task.teamId,
        packageType: spec.packageType,
        status: spec.status,
        createdById: spec.actorId,
        createdAt: hoursAgo(spec.createdHoursAgo),
        sealedAt: sealed ? hoursAgo(spec.createdHoursAgo - 1) : null,
        departedAt: ['IN_TRANSIT', 'RECEIVED_AT_HUB', 'DELIVERED_TO_ROOM'].includes(spec.status)
          ? hoursAgo(Math.max(1, spec.createdHoursAgo - 3))
          : null,
        receivedAt: ['RECEIVED_AT_HUB', 'DELIVERED_TO_ROOM'].includes(spec.status)
          ? hoursAgo(Math.max(1, spec.createdHoursAgo - 5))
          : null,
        deliveredAt:
          spec.status === 'DELIVERED_TO_ROOM'
            ? hoursAgo(Math.max(1, spec.createdHoursAgo - 6))
            : null,
      },
    });

    const events: Array<{ from: string | null; to: string; note: string }> = [
      { from: null, to: 'OPEN', note: 'אריזה נפתחה' },
    ];

    // תכולה: פריטים ייחודיים.
    for (const assetId of spec.contents.assetIds) {
      const asset = await prisma.assetInstance.findUnique({
        where: { id: assetId },
        include: { product: { select: { name: true } } },
      });
      if (!asset) continue;

      await prisma.packageAsset.create({
        data: {
          packageId: pkg.id,
          assetInstanceId: assetId,
          assetTagSnapshot: asset.assetTag,
          productNameSnapshot: asset.product.name,
          ownerNameSnapshot: asset.ownerName,
        },
      });

      const assetStatus =
        spec.status === 'DELIVERED_TO_ROOM'
          ? 'DELIVERED'
          : spec.status === 'RECEIVED_AT_HUB'
            ? 'RECEIVED'
            : spec.status === 'IN_TRANSIT'
              ? 'IN_TRANSIT'
              : 'PACKED';

      await prisma.assetInstance.update({
        where: { id: assetId },
        data: {
          status: assetStatus,
          currentRoomId:
            spec.status === 'DELIVERED_TO_ROOM' ? spec.task.destinationRoomId : asset.currentRoomId,
          reservedForTaskId: spec.status === 'DELIVERED_TO_ROOM' ? null : asset.reservedForTaskId,
        },
      });

      const line = spec.lines.find((item) => item.assetId === assetId);
      if (line) {
        await prisma.packingTaskLine.update({
          where: { id: line.id },
          data: { packedQuantity: 1 },
        });
      }
    }

    // תכולה: ציוד כמותי.
    for (const bulk of spec.contents.bulk) {
      await prisma.packageBulkLine.create({
        data: {
          packageId: pkg.id,
          productCatalogItemId: productBySku.get(bulk.sku)!.id,
          quantity: bulk.quantity,
        },
      });

      const inventoryId = inventoryIds.get(inventoryKey(spec.task.sourceRoomId, bulk.sku))!;
      await prisma.roomInventory.update({
        where: { id: inventoryId },
        data: {
          reservedQuantity: { decrement: bulk.quantity },
          packedQuantity: { increment: bulk.quantity },
        },
      });

      if (spec.status === 'DELIVERED_TO_ROOM') {
        await prisma.roomInventory.update({
          where: { id: inventoryId },
          data: {
            packedQuantity: { decrement: bulk.quantity },
            mappedQuantity: { decrement: bulk.quantity },
          },
        });
        const product = productBySku.get(bulk.sku)!;
        await prisma.roomInventory.upsert({
          where: {
            roomId_productCatalogItemId: {
              roomId: spec.task.destinationRoomId,
              productCatalogItemId: product.id,
            },
          },
          create: {
            roomId: spec.task.destinationRoomId,
            productCatalogItemId: product.id,
            mappedQuantity: bulk.quantity,
            deliveredQuantity: bulk.quantity,
          },
          update: {
            mappedQuantity: { increment: bulk.quantity },
            deliveredQuantity: { increment: bulk.quantity },
          },
        });
      }

      const line = spec.lines.find((item) => item.sku === bulk.sku && !item.assetId);
      if (line) {
        await prisma.packingTaskLine.update({
          where: { id: line.id },
          data: { packedQuantity: { increment: bulk.quantity } },
        });
      }
    }

    if (sealed) {
      events.push({ from: 'OPEN', to: 'SEALED', note: 'החייל סיים להזין תכולה' });
      events.push({
        from: 'SEALED',
        to: 'READY_FOR_SHIPMENT',
        note: 'בדיקת תקינות עברה בהצלחה',
      });
    }
    if (['ASSIGNED_TO_MISSION', 'IN_TRANSIT', 'RECEIVED_AT_HUB', 'DELIVERED_TO_ROOM'].includes(spec.status)) {
      events.push({
        from: 'READY_FOR_SHIPMENT',
        to: 'ASSIGNED_TO_MISSION',
        note: 'שובצה לשליחות',
      });
    }
    if (['IN_TRANSIT', 'RECEIVED_AT_HUB', 'DELIVERED_TO_ROOM'].includes(spec.status)) {
      events.push({
        from: 'ASSIGNED_TO_MISSION',
        to: 'IN_TRANSIT',
        note: 'השליחות יצאה לדרך. תכולת האריזה נעולה',
      });
    }
    if (['RECEIVED_AT_HUB', 'DELIVERED_TO_ROOM'].includes(spec.status)) {
      events.push({
        from: 'IN_TRANSIT',
        to: 'RECEIVED_AT_HUB',
        note: 'התקבל בקריית התקשוב',
      });
    }
    if (spec.status === 'DELIVERED_TO_ROOM') {
      events.push({
        from: 'RECEIVED_AT_HUB',
        to: 'DELIVERED_TO_ROOM',
        note: 'הונח בחדר היעד',
      });
    }

    let eventTime = spec.createdHoursAgo;
    for (const event of events) {
      await prisma.packageStatusEvent.create({
        data: {
          packageId: pkg.id,
          fromStatus: event.from as never,
          toStatus: event.to as never,
          actorUserId: spec.actorId,
          note: event.note,
          createdAt: hoursAgo(Math.max(0.5, eventTime)),
        },
      });
      eventTime = Math.max(0.5, eventTime - 1);
    }

    return pkg;
  }

  // --- משימה 1: הושלמה, האריזות כבר הגיעו לחדר ---
  const task1 = await createTask({
    sourceKey: 'GDN:12',
    destinationRoomNumber: '201',
    teamCode: 'DEV-A',
    soldierId: soldierGdnId,
    priority: 'HIGH',
    status: 'COMPLETED',
    createdHoursAgo: 72,
    notes: 'פינוי עמדות צוות פיתוח א׳',
    bulk: [
      { sku: 'ACC-MOUSE', quantity: 6 },
      { sku: 'ACC-KEYB', quantity: 6 },
    ],
    assetCount: 3,
  });
  const package1 = await createPackage({
    task: {
      id: task1.task.id,
      sourceRoomId: task1.sourceRoomId,
      destinationRoomId: task1.destinationRoomId,
      teamId: teamByCode.get('DEV-A')!,
    },
    lines: task1.lines,
    contents: {
      assetIds: task1.assets.map((asset) => asset.id),
      bulk: [{ sku: 'ACC-MOUSE', quantity: 6 }],
    },
    status: 'DELIVERED_TO_ROOM',
    packageType: 'PROFESSIONAL_BOX',
    createdHoursAgo: 70,
    actorId: soldierGdnId,
  });
  const package2 = await createPackage({
    task: {
      id: task1.task.id,
      sourceRoomId: task1.sourceRoomId,
      destinationRoomId: task1.destinationRoomId,
      teamId: teamByCode.get('DEV-A')!,
    },
    lines: task1.lines,
    contents: { assetIds: [], bulk: [{ sku: 'ACC-KEYB', quantity: 6 }] },
    status: 'DELIVERED_TO_ROOM',
    packageType: 'PERSONAL_BOX',
    createdHoursAgo: 69,
    actorId: soldierGdnId,
  });
  await prisma.packingTask.update({
    where: { id: task1.task.id },
    data: { completedAt: hoursAgo(66) },
  });

  // --- משימה 2: בביצוע, אריזה פתוחה ---
  const task2 = await createTask({
    sourceKey: 'GDN:3',
    destinationRoomNumber: '103',
    teamCode: 'NET',
    soldierId: soldierGdnId,
    priority: 'NORMAL',
    status: 'IN_PROGRESS',
    createdHoursAgo: 20,
    notes: 'פינוי מעבדת רשת - לשמור על סדר הכבלים',
    bulk: [
      { sku: 'ACC-LAN-3', quantity: 10 },
      { sku: 'NET-SW-24', quantity: 2 },
    ],
    assetCount: 2,
  });
  const package3 = await createPackage({
    task: {
      id: task2.task.id,
      sourceRoomId: task2.sourceRoomId,
      destinationRoomId: task2.destinationRoomId,
      teamId: teamByCode.get('NET')!,
    },
    lines: task2.lines,
    contents: {
      assetIds: task2.assets.slice(0, 1).map((asset) => asset.id),
      bulk: [{ sku: 'ACC-LAN-3', quantity: 4 }],
    },
    status: 'OPEN',
    packageType: 'CRATE',
    createdHoursAgo: 6,
    actorId: soldierGdnId,
  });

  // --- משימה 3: צריפין, אריזה מוכנה ומשובצת לשליחות מתוכננת ---
  const task3 = await createTask({
    sourceKey: 'TZR:8',
    destinationRoomNumber: '304',
    teamCode: 'NOC',
    soldierId: soldierTzrId,
    priority: 'URGENT',
    status: 'IN_PROGRESS',
    createdHoursAgo: 30,
    notes: 'ציוד חמ״ל - עדיפות עליונה',
    bulk: [{ sku: 'ACC-DOCK', quantity: 3 }],
    assetCount: 3,
  });
  const package4 = await createPackage({
    task: {
      id: task3.task.id,
      sourceRoomId: task3.sourceRoomId,
      destinationRoomId: task3.destinationRoomId,
      teamId: teamByCode.get('NOC')!,
    },
    lines: task3.lines,
    contents: {
      assetIds: task3.assets.map((asset) => asset.id),
      bulk: [{ sku: 'ACC-DOCK', quantity: 3 }],
    },
    status: 'ASSIGNED_TO_MISSION',
    packageType: 'PROFESSIONAL_BOX',
    createdHoursAgo: 26,
    actorId: soldierTzrId,
  });

  // --- משימה 4: מעבדת חומרה בצריפין ---
  const task4 = await createTask({
    sourceKey: 'TZR:2',
    destinationRoomNumber: '508',
    teamCode: 'LAB',
    soldierId: soldierTzrId,
    priority: 'HIGH',
    status: 'IN_PROGRESS',
    createdHoursAgo: 28,
    bulk: [
      { sku: 'LAB-OSC', quantity: 2 },
      { sku: 'LAB-PSU', quantity: 2 },
    ],
    assetCount: 1,
  });
  const package5 = await createPackage({
    task: {
      id: task4.task.id,
      sourceRoomId: task4.sourceRoomId,
      destinationRoomId: task4.destinationRoomId,
      teamId: teamByCode.get('LAB')!,
    },
    lines: task4.lines,
    contents: {
      assetIds: task4.assets.map((asset) => asset.id),
      bulk: [
        { sku: 'LAB-OSC', quantity: 2 },
        { sku: 'LAB-PSU', quantity: 2 },
      ],
    },
    status: 'ASSIGNED_TO_MISSION',
    packageType: 'CRATE',
    createdHoursAgo: 24,
    actorId: soldierTzrId,
  });

  // --- משימה 5: מחסן גדעונים, אריזה מוכנה שממתינה לשיבוץ (בקשת הצטרפות) ---
  const task5 = await createTask({
    sourceKey: 'GDN:5',
    destinationRoomNumber: '102',
    teamCode: 'LOG-GDN',
    soldierId: soldierGdnId,
    priority: 'NORMAL',
    status: 'IN_PROGRESS',
    createdHoursAgo: 40,
    bulk: [
      { sku: 'OFF-BOX', quantity: 8 },
      { sku: 'ACC-HDMI', quantity: 5 },
    ],
    assetCount: 0,
  });
  const package6 = await createPackage({
    task: {
      id: task5.task.id,
      sourceRoomId: task5.sourceRoomId,
      destinationRoomId: task5.destinationRoomId,
      teamId: teamByCode.get('LOG-GDN')!,
    },
    lines: task5.lines,
    contents: {
      assetIds: [],
      bulk: [
        { sku: 'OFF-BOX', quantity: 8 },
        { sku: 'ACC-HDMI', quantity: 5 },
      ],
    },
    status: 'READY_FOR_SHIPMENT',
    packageType: 'BULK_CONTAINER',
    createdHoursAgo: 36,
    actorId: soldierGdnId,
  });

  // --- משימה 6: משויכת וטרם התחילה (המשימה הבאה של החייל) ---
  const task6 = await createTask({
    sourceKey: 'GDN:14',
    destinationRoomNumber: '202',
    teamCode: 'DEV-B',
    soldierId: soldierGdnId,
    priority: 'HIGH',
    status: 'ASSIGNED',
    createdHoursAgo: 4,
    notes: 'להתחיל אחרי סיום מעבדת הרשת',
    bulk: [{ sku: 'ACC-HEADSET', quantity: 6 }],
    assetCount: 3,
  });

  // --- משימה 7: צריפין, דחופה וטרם התחילה ---
  const task7 = await createTask({
    sourceKey: 'TZR:10',
    destinationRoomNumber: '305',
    teamCode: 'SUPPORT',
    soldierId: soldierTzrId,
    priority: 'URGENT',
    status: 'ASSIGNED',
    createdHoursAgo: 2,
    bulk: [{ sku: 'ACC-KEYB', quantity: 4 }],
    assetCount: 2,
  });

  // --- משימה 8: אריזות בדרך לקריית התקשוב ---
  const task8 = await createTask({
    sourceKey: 'TZR:22',
    destinationRoomNumber: '306',
    teamCode: 'INTEG',
    soldierId: soldierTzrId,
    priority: 'NORMAL',
    status: 'COMPLETED',
    createdHoursAgo: 14,
    bulk: [{ sku: 'ACC-DP', quantity: 6 }],
    assetCount: 2,
  });
  const package7 = await createPackage({
    task: {
      id: task8.task.id,
      sourceRoomId: task8.sourceRoomId,
      destinationRoomId: task8.destinationRoomId,
      teamId: teamByCode.get('INTEG')!,
    },
    lines: task8.lines,
    contents: {
      assetIds: task8.assets.map((asset) => asset.id),
      bulk: [{ sku: 'ACC-DP', quantity: 6 }],
    },
    status: 'IN_TRANSIT',
    packageType: 'PROFESSIONAL_BOX',
    createdHoursAgo: 12,
    actorId: soldierTzrId,
  });
  await prisma.packingTask.update({
    where: { id: task8.task.id },
    data: { completedAt: hoursAgo(10) },
  });

  // ---------- שליחויות ----------
  const createMission = async (spec: {
    title: string;
    status: 'PLANNED' | 'IN_TRANSIT' | 'COMPLETED';
    assignedSoldierId: string;
    pickupBaseCodes: string[];
    packages: Array<{ id: string; baseCode: string }>;
    plannedDepartureHours: number;
    requiresSecuredTransport: boolean;
    securedTransportNotes?: string;
    distanceKm: number;
    durationMinutes: number;
    explanation: string[];
  }) => {
    missionSeq += 1;
    const mission = await prisma.transportMission.create({
      data: {
        missionNumber: formatFriendlyId(ID_PREFIX.MISSION, missionSeq),
        title: spec.title,
        createdById: commanderId,
        assignedSoldierId: spec.assignedSoldierId,
        vehicleType: 'TRUCK',
        licensePlate: `${between(10, 99)}-${between(100, 999)}-${between(10, 99)}`,
        requiresSecuredTransport: spec.requiresSecuredTransport,
        securedTransportNotes: spec.requiresSecuredTransport
          ? (spec.securedTransportNotes ?? 'נסיעה בשעות היום בלבד, ליווי לפי נוהל')
          : null,
        plannedDepartureAt:
          spec.plannedDepartureHours >= 0
            ? hoursFromNow(spec.plannedDepartureHours)
            : hoursAgo(-spec.plannedDepartureHours),
        actualDepartureAt:
          spec.status === 'IN_TRANSIT' || spec.status === 'COMPLETED' ? hoursAgo(8) : null,
        completedAt: spec.status === 'COMPLETED' ? hoursAgo(60) : null,
        status: spec.status,
        routeDistanceKmEstimate: spec.distanceKm,
        routeDurationMinutesEstimate: spec.durationMinutes,
        optimizationScore: between(55, 92),
        routeExplanation: spec.explanation,
      },
    });

    const stopIdByBase = new Map<string, string>();
    let sequence = 0;

    const startStop = await prisma.missionStop.create({
      data: {
        transportMissionId: mission.id,
        baseId: hubBaseId,
        sequence: sequence++,
        stopType: 'START',
        status: spec.status === 'PLANNED' ? 'PLANNED' : 'COMPLETED',
        arrivedAt: spec.status === 'PLANNED' ? null : hoursAgo(9),
        completedAt: spec.status === 'PLANNED' ? null : hoursAgo(9),
      },
    });
    stopIdByBase.set('KT', startStop.id);

    for (const baseCode of spec.pickupBaseCodes) {
      const stop = await prisma.missionStop.create({
        data: {
          transportMissionId: mission.id,
          baseId: baseByCode.get(baseCode)!,
          sequence: sequence++,
          stopType: 'PICKUP',
          status: spec.status === 'PLANNED' ? 'PLANNED' : 'COMPLETED',
          arrivedAt: spec.status === 'PLANNED' ? null : hoursAgo(8.5),
          completedAt: spec.status === 'PLANNED' ? null : hoursAgo(8.2),
        },
      });
      stopIdByBase.set(baseCode, stop.id);
    }

    await prisma.missionStop.create({
      data: {
        transportMissionId: mission.id,
        baseId: hubBaseId,
        sequence: sequence++,
        stopType: 'DELIVERY_HUB',
        status: spec.status === 'COMPLETED' ? 'COMPLETED' : 'PLANNED',
        arrivedAt: spec.status === 'COMPLETED' ? hoursAgo(62) : null,
        completedAt: spec.status === 'COMPLETED' ? hoursAgo(61) : null,
      },
    });

    for (const item of spec.packages) {
      await prisma.missionPackage.create({
        data: {
          transportMissionId: mission.id,
          packageId: item.id,
          pickupStopId: stopIdByBase.get(item.baseCode)!,
          loadedAt: spec.status === 'PLANNED' ? null : hoursAgo(8.4),
          loadedById: spec.status === 'PLANNED' ? null : spec.assignedSoldierId,
          unloadedAt: spec.status === 'COMPLETED' ? hoursAgo(61.5) : null,
          unloadedById: spec.status === 'COMPLETED' ? soldierKtId : null,
        },
      });
    }

    return mission;
  };

  await createMission({
    title: 'איסוף צוות פיתוח א׳ מגדעונים',
    status: 'COMPLETED',
    assignedSoldierId: soldierGdnId,
    pickupBaseCodes: ['GDN'],
    packages: [
      { id: package1.id, baseCode: 'GDN' },
      { id: package2.id, baseCode: 'GDN' },
    ],
    plannedDepartureHours: -70,
    requiresSecuredTransport: false,
    distanceKm: 182.4,
    durationMinutes: 240,
    explanation: [
      'השליחות אספה 2 אריזות מבסיס אחד וחזרה לקריית התקשוב.',
      'ההצעה מבוססת על נקודות ציון דמה ועל חישוב מרחק אווירי.',
    ],
  });

  const plannedMission = await createMission({
    title: 'איסוף חמ״ל ומעבדה מצריפין',
    status: 'PLANNED',
    assignedSoldierId: soldierTzrId,
    pickupBaseCodes: ['TZR'],
    packages: [
      { id: package4.id, baseCode: 'TZR' },
      { id: package5.id, baseCode: 'TZR' },
    ],
    plannedDepartureHours: 18,
    requiresSecuredTransport: true,
    securedTransportNotes: 'ציוד חמ״ל - נדרשת נסיעה מאובטחת בשעות היום, ליווי לפי נוהל.',
    distanceKm: 156.2,
    durationMinutes: 205,
    explanation: [
      'המסלול אוסף 2 אריזות מצריפין וחוזר לקריית התקשוב.',
      'בסיס עם אריזות דחופות הוקדם במסלול: צריפין (דחופה).',
      'ההצעה מבוססת על נקודות ציון דמה. זו הצעה לשיקול המפקד, לא אופטימום מתמטי מובטח.',
    ],
  });

  await createMission({
    title: 'שליחות אינטגרציה בדרך לקריית התקשוב',
    status: 'IN_TRANSIT',
    assignedSoldierId: soldierKtId,
    pickupBaseCodes: ['TZR'],
    packages: [{ id: package7.id, baseCode: 'TZR' }],
    plannedDepartureHours: -9,
    requiresSecuredTransport: false,
    distanceKm: 151.8,
    durationMinutes: 198,
    explanation: [
      'השליחות אוספת אריזה אחת מצריפין וחוזרת לקריית התקשוב.',
      'ההצעה מבוססת על נקודות ציון דמה ועל חישוב מרחק אווירי.',
    ],
  });

  // ---------- בקשת הצטרפות ממתינה ----------
  console.log('יוצר בקשת הצטרפות ממתינה לאישור...');
  await prisma.missionJoinRequest.create({
    data: {
      transportMissionId: plannedMission.id,
      requestingUserId: soldierGdnId,
      baseId: baseByCode.get('GDN')!,
      status: 'PENDING',
      note: 'יש אריזה מוכנה במחסן גדעונים, אפשר להוסיף עצירה בדרך',
      packages: { create: [{ packageId: package6.id }] },
      createdAt: hoursAgo(3),
    },
  });

  // ---------- Audit התחלתי ----------
  await prisma.auditLog.create({
    data: {
      actorUserId: commanderId,
      action: 'TASK_CREATED',
      entityType: 'PackingTask',
      entityId: task1.task.id,
      metadata: { seed: true, note: 'נוצר על ידי ה-Seed' },
      createdAt: hoursAgo(72),
    },
  });

  await syncSequences({
    lastTask: taskSeq,
    lastPackage: packageSeq,
    lastMission: missionSeq,
  });

  // ---------- סיכום ----------
  const counts = {
    bases: await prisma.base.count(),
    teams: await prisma.team.count(),
    rooms: await prisma.room.count(),
    floorMaps: await prisma.floorMap.count(),
    catalog: await prisma.productCatalogItem.count(),
    assets: await prisma.assetInstance.count(),
    inventoryLines: await prisma.roomInventory.count(),
    tasks: await prisma.packingTask.count(),
    packages: await prisma.package.count(),
    missions: await prisma.transportMission.count(),
  };

  console.log('\nה-Seed הסתיים בהצלחה:');
  console.table(counts);
  console.log('\nמשתמשי דמו:');
  for (const user of DEMO_USERS) {
    console.log(`  ${user.email.padEnd(28)} ${user.role.padEnd(20)} ${user.description}`);
  }
  console.log(`\nסיסמת הדמו: ${password}`);
  if (generated) {
    console.log('הסיסמה נוצרה אקראית ומוצגת פעם אחת בלבד. שמרו אותה במקום בטוח.');
  }
  console.log('\nכל הנתונים סינתטיים ואינם מייצגים מידע אמיתי.\n');

  void package3;
  void package6;
  void task6;
  void task7;
}

/**
 * הרצה כ-CLI: npm run seed.
 * טעינת .env מוגבלת לנתיב ה-CLI בלבד - כשה-Seed מיובא כמודול (מ-e2e-server.ts
 * או מבדיקות), משתני הסביבה כבר מוגדרים במפורש ואין לדרוס אותם בטעות.
 */
if (require.main === module) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- טעינה מותנית, ראו הערה למעלה
  require('dotenv/config');
  const client = new PrismaClient();
  runSeed(client)
    .catch((error) => {
      console.error('ה-Seed נכשל:', error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await client.$disconnect();
    });
}
