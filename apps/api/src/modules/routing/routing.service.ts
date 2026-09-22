import { Inject, Injectable } from '@nestjs/common';
import {
  AVERAGE_SPEED_KMH,
  RouteLegDto,
  RouteSuggestionDto,
  STOP_SERVICE_MINUTES,
  StopType,
  TASK_PRIORITY_WEIGHT,
  TASK_PRIORITY_LABEL,
  TaskPriority,
} from '@south/shared';
import { DISTANCE_PROVIDER, DistanceProvider, GeoPoint } from './distance.provider';

/** בסיס איסוף עם המידע שמשפיע על סדר העצירות. */
export interface PickupCandidate extends GeoPoint {
  baseId: string;
  baseCode: string;
  baseName: string;
  packageCount: number;
  highestPriority: TaskPriority | null;
  longestWaitHours: number;
}

export interface HubBase extends GeoPoint {
  baseId: string;
  baseCode: string;
  baseName: string;
}

/**
 * הצעת מסלול (§9).
 *
 * המטרה היא הצעה שימושית וניתנת להסבר, לא פתרון VRP מלא:
 * 1. קיבוץ אריזות לפי בסיס מקור.
 * 2. ציון עדיפות לכל בסיס לפי דחיפות, כמות אריזות וזמן המתנה.
 * 3. מרחקים ב-Haversine דרך Adapter שניתן להחליף.
 * 4. בניית מסלול ב-Nearest Neighbor עם Tie Break לפי דחיפות.
 * 5. שיפור ב-2-opt.
 * 6. החזרת סדר, מרחק, זמן והסבר קצר.
 */
@Injectable()
export class RoutingService {
  /** כל דרגת דחיפות שווה "הנחה" של 2 ק״מ בבחירת העצירה הבאה. */
  private static readonly PRIORITY_KM_BONUS = 2;
  /** כל יממת המתנה שווה הנחה של 1 ק״מ. */
  private static readonly WAIT_KM_BONUS_PER_DAY = 1;

  constructor(
    @Inject(DISTANCE_PROVIDER) private readonly distances: DistanceProvider,
  ) {}

  suggest(hub: HubBase, pickups: PickupCandidate[]): RouteSuggestionDto {
    if (pickups.length === 0) {
      return {
        stops: [
          { ...this.hubStop(hub, StopType.START, 0) },
          { ...this.hubStop(hub, StopType.DELIVERY_HUB, 1) },
        ],
        legs: [],
        totalDistanceKm: 0,
        totalDurationMinutes: 0,
        optimizationScore: 0,
        explanation: ['לא נבחרו אריזות, ולכן אין עצירות איסוף להציע'],
        estimatedTripsSaved: 0,
      };
    }

    const nearestNeighborOrder = this.buildNearestNeighborRoute(hub, pickups);
    const improvedOrder = this.improveWithTwoOpt(hub, nearestNeighborOrder);

    const beforeDistance = this.tourDistance(hub, nearestNeighborOrder);
    const totalDistanceKm = this.tourDistance(hub, improvedOrder);

    const legs = this.buildLegs(hub, improvedOrder);
    const drivingMinutes = (totalDistanceKm / AVERAGE_SPEED_KMH) * 60;
    const totalDurationMinutes = Math.round(
      drivingMinutes + improvedOrder.length * STOP_SERVICE_MINUTES,
    );

    const stops: RouteSuggestionDto['stops'] = [
      this.hubStop(hub, StopType.START, 0),
      ...improvedOrder.map((pickup, index) => ({
        baseId: pickup.baseId,
        baseCode: pickup.baseCode,
        baseName: pickup.baseName,
        stopType: StopType.PICKUP,
        sequence: index + 1,
        packageCount: pickup.packageCount,
        highestPriority: pickup.highestPriority,
        longestWaitHours: Math.round(pickup.longestWaitHours),
      })),
      this.hubStop(hub, StopType.DELIVERY_HUB, improvedOrder.length + 1),
    ];

    return {
      stops,
      legs,
      totalDistanceKm: round(totalDistanceKm, 1),
      totalDurationMinutes,
      optimizationScore: this.optimizationScore(improvedOrder, totalDistanceKm),
      explanation: this.explain(improvedOrder, totalDistanceKm, beforeDistance, totalDurationMinutes),
      estimatedTripsSaved: Math.max(0, improvedOrder.length - 1),
    };
  }

  /**
   * חישוב מדדים לסדר עצירות שנקבע ידנית על ידי המפקד (§9 - "חשב מחדש אחרי שינוי").
   * אין כאן אופטימיזציה: הסדר נשמר בדיוק כפי שהמפקד קבע.
   */
  metricsForOrder(
    hub: HubBase,
    orderedPickups: PickupCandidate[],
  ): {
    legs: RouteLegDto[];
    totalDistanceKm: number;
    totalDurationMinutes: number;
    optimizationScore: number;
    explanation: string[];
  } {
    const totalDistanceKm = this.tourDistance(hub, orderedPickups);
    const drivingMinutes = (totalDistanceKm / AVERAGE_SPEED_KMH) * 60;
    const totalDurationMinutes = Math.round(
      drivingMinutes + orderedPickups.length * STOP_SERVICE_MINUTES,
    );

    return {
      legs: this.buildLegs(hub, orderedPickups),
      totalDistanceKm: round(totalDistanceKm, 1),
      totalDurationMinutes,
      optimizationScore: this.optimizationScore(orderedPickups, totalDistanceKm),
      explanation: [
        'סדר העצירות נקבע ידנית על ידי המפקד.',
        ...this.explain(orderedPickups, totalDistanceKm, totalDistanceKm, totalDurationMinutes),
      ],
    };
  }

  /** בניית מסלול ראשוני: מהנקודה הנוכחית לבסיס עם ה"עלות" הנמוכה ביותר. */
  private buildNearestNeighborRoute(
    hub: HubBase,
    pickups: PickupCandidate[],
  ): PickupCandidate[] {
    const remaining = [...pickups];
    const route: PickupCandidate[] = [];
    let current: GeoPoint = hub;

    while (remaining.length > 0) {
      let bestIndex = 0;
      let bestCost = Number.POSITIVE_INFINITY;

      remaining.forEach((candidate, index) => {
        const distance = this.distances.distanceKm(current, candidate);
        const cost = distance - this.urgencyBonusKm(candidate);
        if (cost < bestCost - 1e-9) {
          bestCost = cost;
          bestIndex = index;
        }
      });

      const [next] = remaining.splice(bestIndex, 1);
      route.push(next);
      current = next;
    }

    return route;
  }

  /** "הנחה" בק״מ עבור דחיפות וזמן המתנה - כך ש-Tie Break מקדם אריזות דחופות. */
  private urgencyBonusKm(candidate: PickupCandidate): number {
    const priorityWeight = candidate.highestPriority
      ? TASK_PRIORITY_WEIGHT[candidate.highestPriority]
      : 0;
    const waitDays = candidate.longestWaitHours / 24;
    return (
      priorityWeight * RoutingService.PRIORITY_KM_BONUS +
      waitDays * RoutingService.WAIT_KM_BONUS_PER_DAY
    );
  }

  /** שיפור 2-opt פשוט: היפוך קטעים כל עוד המרחק הכולל יורד. */
  private improveWithTwoOpt(hub: HubBase, order: PickupCandidate[]): PickupCandidate[] {
    if (order.length < 3) return order;

    let best = [...order];
    let bestDistance = this.tourDistance(hub, best);
    let improved = true;
    let guard = 0;

    while (improved && guard < 50) {
      improved = false;
      guard += 1;

      for (let i = 0; i < best.length - 1; i += 1) {
        for (let j = i + 1; j < best.length; j += 1) {
          const candidate = [
            ...best.slice(0, i),
            ...best.slice(i, j + 1).reverse(),
            ...best.slice(j + 1),
          ];
          const candidateDistance = this.tourDistance(hub, candidate);
          if (candidateDistance < bestDistance - 0.01) {
            best = candidate;
            bestDistance = candidateDistance;
            improved = true;
          }
        }
      }
    }

    return best;
  }

  private tourDistance(hub: HubBase, order: PickupCandidate[]): number {
    if (order.length === 0) return 0;
    let total = this.distances.distanceKm(hub, order[0]);
    for (let i = 0; i < order.length - 1; i += 1) {
      total += this.distances.distanceKm(order[i], order[i + 1]);
    }
    total += this.distances.distanceKm(order[order.length - 1], hub);
    return total;
  }

  private buildLegs(hub: HubBase, order: PickupCandidate[]): RouteLegDto[] {
    const points = [hub, ...order, hub];
    const legs: RouteLegDto[] = [];

    for (let i = 0; i < points.length - 1; i += 1) {
      const from = points[i];
      const to = points[i + 1];
      const distanceKm = this.distances.distanceKm(from, to);
      legs.push({
        fromBaseName: from.baseName,
        toBaseName: to.baseName,
        distanceKm: round(distanceKm, 1),
        durationMinutes: Math.round((distanceKm / AVERAGE_SPEED_KMH) * 60),
      });
    }

    return legs;
  }

  /**
   * ציון יעילות 0-100 להצגה למפקד.
   * מבוסס על צפיפות האיסוף (אריזות לק״מ) ועל מספר הבסיסים שאוחדו.
   * זהו מדד השוואתי להצגה, ולא ערבות לאופטימום.
   */
  private optimizationScore(order: PickupCandidate[], totalDistanceKm: number): number {
    const packages = order.reduce((sum, stop) => sum + stop.packageCount, 0);
    if (packages === 0 || totalDistanceKm <= 0) return 0;
    const density = packages / totalDistanceKm;
    const consolidation = Math.min(1, order.length / 4);
    return round(Math.min(100, density * 40 + consolidation * 40 + 20), 1);
  }

  private explain(
    order: PickupCandidate[],
    totalDistanceKm: number,
    beforeDistance: number,
    totalDurationMinutes: number,
  ): string[] {
    const explanation: string[] = [];
    const packages = order.reduce((sum, stop) => sum + stop.packageCount, 0);

    if (order.length > 1) {
      explanation.push(
        `המסלול מאחד ${order.length} בסיסי איסוף לשליחות אחת ומרכז ${packages} אריזות, ` +
          `במקום ${order.length} נסיעות נפרדות.`,
      );
    } else {
      explanation.push(`השליחות אוספת ${packages} אריזות מבסיס אחד וחוזרת לקריית התקשוב.`);
    }

    const urgent = order.filter(
      (stop) => stop.highestPriority === TaskPriority.URGENT || stop.highestPriority === TaskPriority.HIGH,
    );
    if (urgent.length > 0) {
      const names = urgent.map(
        (stop) => `${stop.baseName} (${TASK_PRIORITY_LABEL[stop.highestPriority!]})`,
      );
      explanation.push(`בסיסים עם אריזות דחופות הוקדמו במסלול: ${names.join(', ')}.`);
    }

    const longestWait = order.reduce(
      (max, stop) => (stop.longestWaitHours > max.longestWaitHours ? stop : max),
      order[0],
    );
    if (longestWait && longestWait.longestWaitHours >= 24) {
      explanation.push(
        `ב-${longestWait.baseName} ממתינה אריזה כבר ${Math.round(longestWait.longestWaitHours / 24)} ימים, ולכן קיבלה עדיפות.`,
      );
    }

    const saved = beforeDistance - totalDistanceKm;
    if (saved > 0.5) {
      explanation.push(
        `שיפור 2-opt קיצר את המסלול ב-${round(saved, 1)} ק״מ לעומת סדר השכן הקרוב.`,
      );
    }

    explanation.push(
      `סה״כ כ-${round(totalDistanceKm, 1)} ק״מ וכ-${Math.round(totalDurationMinutes / 60)} שעות, ` +
        `כולל ${STOP_SERVICE_MINUTES} דקות שירות בכל עצירה.`,
    );
    explanation.push(
      'ההצעה מבוססת על נקודות ציון דמה ועל חישוב מרחק אווירי. זו הצעה לשיקול המפקד, לא אופטימום מתמטי מובטח.',
    );

    return explanation;
  }

  private hubStop(hub: HubBase, stopType: StopType, sequence: number) {
    return {
      baseId: hub.baseId,
      baseCode: hub.baseCode,
      baseName: hub.baseName,
      stopType,
      sequence,
      packageCount: 0,
      highestPriority: null,
      longestWaitHours: 0,
    };
  }
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
