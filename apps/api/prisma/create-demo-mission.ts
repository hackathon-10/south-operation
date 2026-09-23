/**
 * יצירת שליחות (הובלה) לדוגמה, בלי למחוק דבר - לבדיקת המערכת מול תפקידים שונים.
 *
 * `prisma/seed.ts` מוחק את כל הטבלאות לפני שהוא זורע מחדש, ולכן אינו מתאים
 * למסד שכבר יש בו נתונים אמיתיים. הסקריפט הזה מוסיף שליחות אחת בלבד, מבוססת
 * על אריזות שכבר קיימות ומוכנות למשלוח - בלי ליצור משתמשים, בסיסים או אריזות
 * חדשים משום מקום.
 *
 * דרישות מוקדמות במסד (למשל אחרי `seed` או `create:operation-manager` + זרימת
 * אריזה רגילה עד לסטטוס "מוכנה למשלוח"):
 *   - בסיס יעד אחד עם isDestinationHub = true.
 *   - לפחות אריזה אחת בסטטוס READY_FOR_SHIPMENT שאינה משויכת לשליחות אחרת.
 *   - לפחות מפקד לוגיסטיקה (LOGISTICS_COMMANDER) פעיל אחד, ליצירת השליחות.
 *
 * הרצה:
 *   npm run create:demo-mission -w @south/api
 *
 * משתני סביבה (כולם אופציונליים):
 *   DEMO_MISSION_TITLE            כותרת השליחות. ברירת מחדל: כותרת גנרית.
 *   DEMO_MISSION_COMMANDER_EMAIL  אימייל מפקד ספציפי ליצירת השליחות.
 *   DEMO_MISSION_SOLDIER_EMAIL    אימייל חייל ספציפי לשיבוץ כמבצע השליחות.
 *   DEMO_MISSION_MAX_PACKAGES     כמה אריזות מוכנות לצרף לכל היותר (ברירת מחדל: 3).
 */
import {
  AVERAGE_SPEED_KMH,
  EARTH_RADIUS_KM,
  FRIENDLY_ID_DIGITS,
  ID_PREFIX,
  STOP_SERVICE_MINUTES,
} from '@south/shared';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_TITLE = 'שליחות דמו לבדיקת תפקידים';
const DEFAULT_MAX_PACKAGES = 3;

interface GeoPoint {
  latitude: number;
  longitude: number;
}

interface BaseGeo extends GeoPoint {
  id: string;
  code: string;
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** אותו חישוב Haversine בדיוק כמו ב-RoutingService, כדי שהמספרים ייראו אמיתיים. */
function distanceKm(from: GeoPoint, to: GeoPoint): number {
  const dLat = toRadians(to.latitude - from.latitude);
  const dLon = toRadians(to.longitude - from.longitude);
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);

  const a = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

async function findCommander() {
  const email = process.env.DEMO_MISSION_COMMANDER_EMAIL;
  const where = email ? { email, isActive: true } : { role: 'LOGISTICS_COMMANDER' as const, isActive: true };
  const commander = email
    ? await prisma.user.findFirst({ where })
    : await prisma.user.findFirst({ where, orderBy: { fullName: 'asc' } });

  if (!commander) {
    throw new Error(
      email
        ? `לא נמצא משתמש פעיל עם האימייל ${email}.`
        : 'לא נמצא מפקד לוגיסטיקה (LOGISTICS_COMMANDER) פעיל. יש להריץ seed או ליצור אחד ידנית.',
    );
  }
  return commander;
}

async function findSoldier() {
  const email = process.env.DEMO_MISSION_SOLDIER_EMAIL;
  if (email) {
    const soldier = await prisma.user.findFirst({ where: { email, isActive: true } });
    if (!soldier) throw new Error(`לא נמצא משתמש פעיל עם האימייל ${email}.`);
    return soldier;
  }
  return prisma.user.findFirst({
    where: { role: 'LOGISTICS_SOLDIER', isActive: true },
    orderBy: { fullName: 'asc' },
  });
}

async function main(): Promise<void> {
  const hubBase = await prisma.base.findFirst({ where: { isDestinationHub: true } });
  if (!hubBase) {
    throw new Error('לא נמצא בסיס יעד (isDestinationHub) במסד. יש להריץ migrations ו-Seed קודם.');
  }

  const maxPackages = Number(process.env.DEMO_MISSION_MAX_PACKAGES ?? DEFAULT_MAX_PACKAGES);

  const candidatePackages = await prisma.package.findMany({
    where: { status: 'READY_FOR_SHIPMENT', missionPackage: null },
    take: maxPackages,
    orderBy: { sealedAt: 'asc' },
    include: { sourceRoom: { include: { base: true } } },
  });

  if (candidatePackages.length === 0) {
    throw new Error(
      'לא נמצאה אף אריזה בסטטוס READY_FOR_SHIPMENT שעדיין אינה משויכת לשליחות. ' +
        'יש לסגור ולאשר אריזה אחת לפחות (דרך זרימת האריזה הרגילה) לפני יצירת שליחות דמו.',
    );
  }

  const commander = await findCommander();
  const soldier = await findSoldier();

  const hub: BaseGeo = {
    id: hubBase.id,
    code: hubBase.code,
    latitude: Number(hubBase.latitude),
    longitude: Number(hubBase.longitude),
  };

  const basesById = new Map<string, BaseGeo>();
  for (const pkg of candidatePackages) {
    const base = pkg.sourceRoom.base;
    basesById.set(base.id, {
      id: base.id,
      code: base.code,
      latitude: Number(base.latitude),
      longitude: Number(base.longitude),
    });
  }

  // אריזות שמקורן בבסיס היעד עצמו נאספות בעצירת ההתחלה - אין להן עצירת PICKUP נפרדת.
  const pickupBases = [...basesById.values()].filter((base) => base.id !== hub.id);

  // סדר "השכן הקרוב" פשוט - מספיק לשליחות דמו קטנה, בלי 2-opt.
  const orderedPickupBases: BaseGeo[] = [];
  const remaining = [...pickupBases];
  let current: GeoPoint = hub;
  while (remaining.length > 0) {
    let bestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    remaining.forEach((base, index) => {
      const d = distanceKm(current, base);
      if (d < bestDistance) {
        bestDistance = d;
        bestIndex = index;
      }
    });
    const [next] = remaining.splice(bestIndex, 1);
    orderedPickupBases.push(next);
    current = next;
  }

  const routePoints: GeoPoint[] = [hub, ...orderedPickupBases, hub];
  let totalDistanceKm = 0;
  for (let i = 0; i < routePoints.length - 1; i += 1) {
    totalDistanceKm += distanceKm(routePoints[i], routePoints[i + 1]);
  }

  const drivingMinutes = (totalDistanceKm / AVERAGE_SPEED_KMH) * 60;
  const totalDurationMinutes = Math.round(
    drivingMinutes + orderedPickupBases.length * STOP_SERVICE_MINUTES,
  );

  const optimizationScore =
    totalDistanceKm > 0
      ? round(
          Math.min(
            100,
            (candidatePackages.length / totalDistanceKm) * 40 +
              Math.min(1, orderedPickupBases.length / 4) * 40 +
              20,
          ),
          1,
        )
      : 0;

  const explanation: string[] =
    orderedPickupBases.length > 1
      ? [
          `המסלול מאחד ${orderedPickupBases.length} בסיסי איסוף לשליחות אחת ומרכז ` +
            `${candidatePackages.length} אריזות, במקום ${orderedPickupBases.length} נסיעות נפרדות.`,
        ]
      : orderedPickupBases.length === 1
        ? [`השליחות אוספת ${candidatePackages.length} אריזות מבסיס אחד וחוזרת לקריית התקשוב.`]
        : ['כל האריזות ממוקמות בבסיס היעד עצמו, ולכן אין עצירות איסוף נפרדות.'];

  explanation.push(
    `סה״כ כ-${round(totalDistanceKm, 1)} ק״מ וכ-${Math.round(totalDurationMinutes / 60)} שעות, ` +
      `כולל ${STOP_SERVICE_MINUTES} דקות שירות בכל עצירה.`,
  );
  explanation.push(
    'נוצר על ידי סקריפט הדגמה (create:demo-mission) לבדיקת המערכת בתפקידים שונים - ' +
      'ההערכות מבוססות על נקודות ציון דמה ועל חישוב מרחק אווירי.',
  );

  const [{ value: sequence }] = await prisma.$queryRaw<Array<{ value: bigint }>>`
    SELECT nextval('mission_number_seq') AS value
  `;
  const missionNumber = `${ID_PREFIX.MISSION}${String(Number(sequence)).padStart(FRIENDLY_ID_DIGITS, '0')}`;
  const licensePlate = `${randomBetween(10, 99)}-${randomBetween(100, 999)}-${randomBetween(10, 99)}`;
  const plannedDepartureAt = new Date(Date.now() + 6 * 60 * 60 * 1000);

  const missionId = await prisma.$transaction(async (tx) => {
    const mission = await tx.transportMission.create({
      data: {
        missionNumber,
        title: process.env.DEMO_MISSION_TITLE ?? DEFAULT_TITLE,
        createdById: commander.id,
        assignedSoldierId: soldier?.id ?? null,
        vehicleType: 'TRUCK',
        licensePlate,
        requiresSecuredTransport: false,
        plannedDepartureAt,
        status: soldier ? 'PLANNED' : 'DRAFT',
        routeDistanceKmEstimate: round(totalDistanceKm, 1),
        routeDurationMinutesEstimate: totalDurationMinutes,
        optimizationScore,
        routeExplanation: explanation,
      },
    });

    const stopIdByBase = new Map<string, string>();
    let sequenceIndex = 0;

    const startStop = await tx.missionStop.create({
      data: {
        transportMissionId: mission.id,
        baseId: hubBase.id,
        sequence: sequenceIndex++,
        stopType: 'START',
        status: 'PLANNED',
      },
    });
    stopIdByBase.set(hubBase.id, startStop.id);

    for (const base of orderedPickupBases) {
      const stop = await tx.missionStop.create({
        data: {
          transportMissionId: mission.id,
          baseId: base.id,
          sequence: sequenceIndex++,
          stopType: 'PICKUP',
          status: 'PLANNED',
        },
      });
      stopIdByBase.set(base.id, stop.id);
    }

    await tx.missionStop.create({
      data: {
        transportMissionId: mission.id,
        baseId: hubBase.id,
        sequence: sequenceIndex++,
        stopType: 'DELIVERY_HUB',
        status: 'PLANNED',
      },
    });

    for (const pkg of candidatePackages) {
      const pickupStopId = stopIdByBase.get(pkg.sourceRoom.base.id)!;
      await tx.missionPackage.create({
        data: { transportMissionId: mission.id, packageId: pkg.id, pickupStopId },
      });
      await tx.package.update({
        where: { id: pkg.id },
        data: { status: 'ASSIGNED_TO_MISSION' },
      });
      await tx.packageStatusEvent.create({
        data: {
          packageId: pkg.id,
          fromStatus: 'READY_FOR_SHIPMENT',
          toStatus: 'ASSIGNED_TO_MISSION',
          actorUserId: commander.id,
          missionId: mission.id,
          note: `שובצה לשליחות ${missionNumber} (דמו)`,
        },
      });
    }

    return mission.id;
  });

  console.log('');
  console.log('נוצרה שליחות דמו:');
  console.log(`  מספר:          ${missionNumber}`);
  console.log(`  סטטוס:         ${soldier ? 'PLANNED' : 'DRAFT'}`);
  console.log(`  נוצרה על ידי:  ${commander.fullName} (${commander.email})`);
  console.log(
    `  חייל משובץ:    ${soldier ? `${soldier.fullName} (${soldier.email})` : 'לא שובץ - השליחות ב-DRAFT'}`,
  );
  console.log(`  בסיסי איסוף:   ${orderedPickupBases.map((base) => base.code).join(', ') || '(מהיעד עצמו)'}`);
  console.log(`  אריזות:        ${candidatePackages.length}`);
  console.log(`  מזהה פנימי:    ${missionId}`);
  console.log('');
}

function randomBetween(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
