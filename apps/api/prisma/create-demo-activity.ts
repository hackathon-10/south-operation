/**
 * מוסיף שליחויות ובקשות הצטרפות לדוגמה, בלי למחוק או לשנות דבר קיים -
 * כדי שמסך השליחויות, בקשות ההצטרפות וה-Dashboard לא ייראו ריקים.
 *
 * ממשיך את אותה גישה כמו create-demo-mission.ts: לא ממציא משתמשים, בסיסים
 * או ציוד חדשים - משתמש רק באריזות שכבר קיימות בסטטוס READY_FOR_SHIPMENT
 * ובמשתמשים פעילים שכבר קיימים. כל פעולה היא Best-Effort: אם אין מספיק
 * נתונים זמינים לצעד מסוים, הסקריפט מדלג עליו במקום להיכשל כולו.
 *
 * במכוון לא נוצרות שליחויות IN_TRANSIT/COMPLETED: אלה דורשות שחזור היסטוריה
 * מלאה (זמני הגעה, עדכוני מלאי) כמו ב-seed.ts, ומחוץ להיקף הסקריפט הזה.
 *
 * הרצה:
 *   npm run create:demo-activity -w @south/api
 *
 * משתני סביבה (כולם אופציונליים):
 *   DEMO_EXTRA_MISSIONS   כמה שליחויות PLANNED נוספות ליצור (ברירת מחדל: 2).
 *   DEMO_JOIN_REQUESTS    כמה בקשות הצטרפות לנסות ליצור (ברירת מחדל: 3: 1 ממתינה,
 *                         1 מאושרת, 1 נדחית - כל אחת רק אם יש לה נתונים זמינים).
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

interface GeoPoint {
  latitude: number;
  longitude: number;
}
interface BaseGeo extends GeoPoint {
  id: string;
  code: string;
}
interface PackageGroup {
  base: BaseGeo;
  packages: Array<{ id: string }>;
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

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

function randomBetween(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

/** סדר "שכן קרוב" פשוט + חישוב מרחק/משך/ציון - כמו ב-RoutingService, בלי 2-opt. */
function planRoute(
  hub: BaseGeo,
  pickupBases: BaseGeo[],
  packageCount: number,
): {
  orderedPickupBases: BaseGeo[];
  totalDistanceKm: number;
  totalDurationMinutes: number;
  optimizationScore: number;
} {
  const remaining = [...pickupBases];
  const orderedPickupBases: BaseGeo[] = [];
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
            (packageCount / totalDistanceKm) * 40 +
              Math.min(1, orderedPickupBases.length / 4) * 40 +
              20,
          ),
          1,
        )
      : 0;

  return { orderedPickupBases, totalDistanceKm, totalDurationMinutes, optimizationScore };
}

async function nextMissionNumber(): Promise<string> {
  const [{ value }] = await prisma.$queryRaw<Array<{ value: bigint }>>`
    SELECT nextval('mission_number_seq') AS value
  `;
  return `${ID_PREFIX.MISSION}${String(Number(value)).padStart(FRIENDLY_ID_DIGITS, '0')}`;
}

/** יוצר שליחות PLANNED/DRAFT חדשה מקבוצת אריזות של בסיס אחד, כמו create-demo-mission.ts. */
async function createMissionFromGroup(
  hub: BaseGeo,
  group: PackageGroup,
  commanderId: string,
  assignedSoldierId: string | undefined,
  title: string,
): Promise<{ missionId: string; missionNumber: string }> {
  const plan = planRoute(hub, group.base.id === hub.id ? [] : [group.base], group.packages.length);
  const missionNumber = await nextMissionNumber();
  const licensePlate = `${randomBetween(10, 99)}-${randomBetween(100, 999)}-${randomBetween(10, 99)}`;
  const explanation = [
    group.base.id === hub.id
      ? 'כל האריזות ממוקמות בבסיס היעד עצמו, ולכן אין עצירות איסוף נפרדות.'
      : `השליחות אוספת ${group.packages.length} אריזות מבסיס אחד וחוזרת לקריית התקשוב.`,
    'נוצר על ידי סקריפט הדגמה (create:demo-activity) לבדיקת המערכת בתפקידים שונים.',
  ];

  const missionId = await prisma.$transaction(async (tx) => {
    const mission = await tx.transportMission.create({
      data: {
        missionNumber,
        title,
        createdById: commanderId,
        assignedSoldierId: assignedSoldierId ?? null,
        vehicleType: 'TRUCK',
        licensePlate,
        requiresSecuredTransport: false,
        plannedDepartureAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
        status: assignedSoldierId ? 'PLANNED' : 'DRAFT',
        routeDistanceKmEstimate: round(plan.totalDistanceKm, 1),
        routeDurationMinutesEstimate: plan.totalDurationMinutes,
        optimizationScore: plan.optimizationScore,
        routeExplanation: explanation,
      },
    });

    const stopIdByBase = new Map<string, string>();
    let seq = 0;
    const startStop = await tx.missionStop.create({
      data: { transportMissionId: mission.id, baseId: hub.id, sequence: seq++, stopType: 'START', status: 'PLANNED' },
    });
    stopIdByBase.set(hub.id, startStop.id);

    for (const base of plan.orderedPickupBases) {
      const stop = await tx.missionStop.create({
        data: { transportMissionId: mission.id, baseId: base.id, sequence: seq++, stopType: 'PICKUP', status: 'PLANNED' },
      });
      stopIdByBase.set(base.id, stop.id);
    }
    await tx.missionStop.create({
      data: { transportMissionId: mission.id, baseId: hub.id, sequence: seq++, stopType: 'DELIVERY_HUB', status: 'PLANNED' },
    });

    for (const pkg of group.packages) {
      const pickupStopId = stopIdByBase.get(group.base.id)!;
      await tx.missionPackage.create({
        data: { transportMissionId: mission.id, packageId: pkg.id, pickupStopId },
      });
      await tx.package.update({ where: { id: pkg.id }, data: { status: 'ASSIGNED_TO_MISSION' } });
      await tx.packageStatusEvent.create({
        data: {
          packageId: pkg.id,
          fromStatus: 'READY_FOR_SHIPMENT',
          toStatus: 'ASSIGNED_TO_MISSION',
          actorUserId: commanderId,
          missionId: mission.id,
          note: `שובצה לשליחות ${missionNumber} (דמו)`,
        },
      });
    }

    return mission.id;
  });

  return { missionId, missionNumber };
}

/** מאשר בקשת הצטרפות: מוסיף/מאחד עצירת איסוף, משייך את האריזות ומחשב מסלול מחדש. */
async function approveJoinRequest(
  hub: BaseGeo,
  missionId: string,
  group: PackageGroup,
  commanderId: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const stops = await tx.missionStop.findMany({
      where: { transportMissionId: missionId },
      orderBy: { sequence: 'asc' },
      include: { base: true, packages: { select: { id: true } } },
    });

    let pickupStop = stops.find((s) => s.baseId === group.base.id && s.stopType !== 'DELIVERY_HUB');
    const deliveryStop = stops.find((s) => s.stopType === 'DELIVERY_HUB');

    if (!pickupStop) {
      if (deliveryStop) {
        await tx.missionStop.update({ where: { id: deliveryStop.id }, data: { sequence: 1000 } });
      }
      pickupStop = await tx.missionStop.create({
        data: {
          transportMissionId: missionId,
          baseId: group.base.id,
          sequence: stops.length - 1,
          stopType: 'PICKUP',
          status: 'PLANNED',
        },
        include: { base: true, packages: { select: { id: true } } },
      });
      if (deliveryStop) {
        await tx.missionStop.update({ where: { id: deliveryStop.id }, data: { sequence: stops.length } });
      }
    }

    for (const pkg of group.packages) {
      await tx.missionPackage.create({
        data: { transportMissionId: missionId, packageId: pkg.id, pickupStopId: pickupStop.id },
      });
      await tx.package.update({ where: { id: pkg.id }, data: { status: 'ASSIGNED_TO_MISSION' } });
      await tx.packageStatusEvent.create({
        data: {
          packageId: pkg.id,
          fromStatus: 'READY_FOR_SHIPMENT',
          toStatus: 'ASSIGNED_TO_MISSION',
          actorUserId: commanderId,
          missionId,
          note: 'שובצה דרך אישור בקשת הצטרפות (דמו)',
        },
      });
    }

    // חישוב מחדש של מדדי המסלול לפי העצירות המעודכנות.
    const freshStops = await tx.missionStop.findMany({
      where: { transportMissionId: missionId },
      orderBy: { sequence: 'asc' },
      include: { base: true },
    });
    const pickups = freshStops.filter((s) => s.stopType === 'PICKUP');
    const bases: BaseGeo[] = pickups.map((s) => ({
      id: s.base.id,
      code: s.base.code,
      latitude: Number(s.base.latitude),
      longitude: Number(s.base.longitude),
    }));
    const plan = planRoute(hub, bases, pickups.length);
    await tx.transportMission.update({
      where: { id: missionId },
      data: {
        routeDistanceKmEstimate: round(plan.totalDistanceKm, 1),
        routeDurationMinutesEstimate: plan.totalDurationMinutes,
        optimizationScore: plan.optimizationScore,
      },
    });
  });
}

async function main(): Promise<void> {
  const hubBase = await prisma.base.findFirst({ where: { isDestinationHub: true } });
  if (!hubBase) throw new Error('לא נמצא בסיס יעד (isDestinationHub) במסד. יש להריץ migrations ו-Seed קודם.');
  const hub: BaseGeo = {
    id: hubBase.id,
    code: hubBase.code,
    latitude: Number(hubBase.latitude),
    longitude: Number(hubBase.longitude),
  };

  const commander = await prisma.user.findFirst({
    where: { role: 'LOGISTICS_COMMANDER', isActive: true },
    orderBy: { fullName: 'asc' },
  });
  if (!commander) {
    throw new Error('לא נמצא מפקד לוגיסטיקה (LOGISTICS_COMMANDER) פעיל. יש להריץ seed או ליצור אחד ידנית.');
  }

  const soldiers = await prisma.user.findMany({
    where: { role: 'LOGISTICS_SOLDIER', isActive: true, baseId: { not: null } },
    orderBy: { fullName: 'asc' },
  });

  const candidatePackages = await prisma.package.findMany({
    where: { status: 'READY_FOR_SHIPMENT', missionPackage: null },
    take: 60,
    orderBy: { sealedAt: 'asc' },
    include: { sourceRoom: { include: { base: true } } },
  });

  const groupsByBase = new Map<string, PackageGroup>();
  for (const pkg of candidatePackages) {
    const base = pkg.sourceRoom.base;
    const existing = groupsByBase.get(base.id);
    const geo: BaseGeo = { id: base.id, code: base.code, latitude: Number(base.latitude), longitude: Number(base.longitude) };
    if (existing) {
      existing.packages.push({ id: pkg.id });
    } else {
      groupsByBase.set(base.id, { base: geo, packages: [{ id: pkg.id }] });
    }
  }
  // כל קבוצה מוגבלת לכל היותר 2 אריזות, כדי לא "לרוקן" בסיס שלם על שליחות דמו אחת.
  const groups = [...groupsByBase.values()].map((g) => ({ ...g, packages: g.packages.slice(0, 2) }));

  console.log('');
  console.log(`נמצאו ${candidatePackages.length} אריזות מוכנות ב-${groups.length} בסיסים שונים.`);
  console.log(`נמצאו ${soldiers.length} חיילי לוגיסטיקה פעילים עם בסיס משויך.`);

  const maxMissions = Number(process.env.DEMO_EXTRA_MISSIONS ?? 2);
  const maxJoinRequests = Number(process.env.DEMO_JOIN_REQUESTS ?? 3);

  const createdMissions: Array<{ missionNumber: string; missionId: string }> = [];
  let groupIndex = 0;
  let soldierIndex = 0;

  for (let i = 0; i < maxMissions; i += 1) {
    if (groupIndex >= groups.length) {
      console.log(`שליחות #${i + 1}: דילוג - אין עוד קבוצת אריזות פנויה.`);
      continue;
    }
    const group = groups[groupIndex++];
    const soldier = soldiers.length > 0 ? soldiers[soldierIndex++ % soldiers.length] : undefined;
    const { missionId, missionNumber } = await createMissionFromGroup(
      hub,
      group,
      commander.id,
      soldier?.id,
      `שליחות דמו נוספת ${i + 1} לבדיקת תפקידים`,
    );
    createdMissions.push({ missionId, missionNumber });
    console.log(
      `שליחות #${i + 1}: נוצרה ${missionNumber} (${soldier ? `PLANNED, חייל ${soldier.fullName}` : 'DRAFT, ללא חייל'}), בסיס ${group.base.code}, ${group.packages.length} אריזות.`,
    );
  }

  // יעד לבקשות ההצטרפות: שליחות PLANNED שכל העצירות בה עדיין PLANNED (טרם החלה העמסה).
  let targetMission = createdMissions.length > 0 ? createdMissions[0] : null;
  if (!targetMission) {
    const existing = await prisma.transportMission.findFirst({
      where: { status: 'PLANNED' },
      include: { stops: { select: { status: true } } },
      orderBy: { createdAt: 'desc' },
    });
    if (existing && existing.stops.every((s) => s.status === 'PLANNED')) {
      targetMission = { missionId: existing.id, missionNumber: existing.missionNumber };
    }
  }

  if (!targetMission) {
    console.log('בקשות הצטרפות: דילוג - אין שליחות PLANNED זמינה (כל העצירות בה טרם החלו) לצרף אליה בקשות.');
  } else {
    const missionAssignedSoldierId = (
      await prisma.transportMission.findUnique({ where: { id: targetMission.missionId }, select: { assignedSoldierId: true } })
    )?.assignedSoldierId;

    const requestPlan: Array<'PENDING' | 'APPROVED' | 'REJECTED'> = ['PENDING', 'APPROVED', 'REJECTED'].slice(
      0,
      maxJoinRequests,
    ) as Array<'PENDING' | 'APPROVED' | 'REJECTED'>;

    for (const [index, status] of requestPlan.entries()) {
      if (groupIndex >= groups.length) {
        console.log(`בקשת הצטרפות #${index + 1} (${status}): דילוג - אין עוד קבוצת אריזות פנויה.`);
        continue;
      }
      const requester = soldiers.find(
        (s, idx) => idx >= soldierIndex && s.baseId === groups[groupIndex].base.id && s.id !== missionAssignedSoldierId,
      );
      if (!requester) {
        console.log(`בקשת הצטרפות #${index + 1} (${status}): דילוג - אין חייל פעיל עם בסיס תואם לקבוצת האריזות הפנויה הבאה.`);
        groupIndex += 1; // מוותרים על הקבוצה הזו כדי לא להיתקע באותה בדיקה שוב.
        continue;
      }

      const group = groups[groupIndex++];

      const request = await prisma.missionJoinRequest.create({
        data: {
          transportMissionId: targetMission.missionId,
          requestingUserId: requester.id,
          baseId: requester.baseId!,
          status: 'PENDING',
          note: 'נוצר על ידי סקריפט הדגמה (create:demo-activity)',
          packages: { create: group.packages.map((pkg) => ({ packageId: pkg.id })) },
        },
      });

      if (status === 'APPROVED') {
        await approveJoinRequest(hub, targetMission.missionId, group, commander.id);
        await prisma.missionJoinRequest.update({
          where: { id: request.id },
          data: { status: 'APPROVED', reviewedById: commander.id, reviewedAt: new Date() },
        });
      } else if (status === 'REJECTED') {
        await prisma.missionJoinRequest.update({
          where: { id: request.id },
          data: { status: 'REJECTED', reviewedById: commander.id, reviewedAt: new Date(), note: 'נדחה לדוגמה - אין מקום במסלול (דמו)' },
        });
      }

      console.log(
        `בקשת הצטרפות #${index + 1}: נוצרה בסטטוס ${status} - חייל ${requester.fullName}, בסיס ${group.base.code}, ${group.packages.length} אריזות, לשליחות ${targetMission.missionNumber}.`,
      );
    }
  }

  console.log('');
  console.log('סיום.');
  console.log('');
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
