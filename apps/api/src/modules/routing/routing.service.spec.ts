import { TaskPriority } from '@south/shared';
import { HaversineDistanceProvider } from './distance.provider';
import { HubBase, PickupCandidate, RoutingService } from './routing.service';

const hub: HubBase = {
  baseId: 'hub',
  baseCode: 'KT',
  baseName: 'קריית התקשוב',
  latitude: 31.25,
  longitude: 34.79,
};

function pickup(overrides: Partial<PickupCandidate> & { baseId: string }): PickupCandidate {
  return {
    baseCode: overrides.baseId.toUpperCase(),
    baseName: overrides.baseId,
    latitude: 32.0,
    longitude: 34.85,
    packageCount: 1,
    highestPriority: TaskPriority.NORMAL,
    longestWaitHours: 0,
    ...overrides,
  } as PickupCandidate;
}

describe('RoutingService', () => {
  let service: RoutingService;

  beforeEach(() => {
    service = new RoutingService(new HaversineDistanceProvider());
  });

  it('מחזיר מסלול ריק כשאין אריזות', () => {
    const result = service.suggest(hub, []);
    expect(result.stops).toHaveLength(2);
    expect(result.totalDistanceKm).toBe(0);
    expect(result.estimatedTripsSaved).toBe(0);
    expect(result.explanation[0]).toContain('לא נבחרו אריזות');
  });

  it('מתחיל ומסיים בקריית התקשוב', () => {
    const result = service.suggest(hub, [
      pickup({ baseId: 'gdn', latitude: 32.02, longitude: 34.85 }),
      pickup({ baseId: 'tzr', latitude: 31.95, longitude: 34.83 }),
    ]);

    expect(result.stops[0].stopType).toBe('START');
    expect(result.stops[0].baseId).toBe('hub');
    expect(result.stops[result.stops.length - 1].stopType).toBe('DELIVERY_HUB');
    expect(result.stops[result.stops.length - 1].baseId).toBe('hub');
  });

  it('ב-Tie Break בין בסיסים במרחק דומה, הבסיס הדחוף מוקדם', () => {
    // שני בסיסים כמעט באותו מרחק מקריית התקשוב (הפרש של כקילומטר).
    const near = pickup({
      baseId: 'regular',
      latitude: 31.6,
      longitude: 34.79,
      highestPriority: TaskPriority.LOW,
    });
    const urgentFar = pickup({
      baseId: 'urgent',
      latitude: 31.61,
      longitude: 34.79,
      highestPriority: TaskPriority.URGENT,
      packageCount: 4,
    });

    const result = service.suggest(hub, [near, urgentFar]);
    const pickups = result.stops.filter((stop) => stop.stopType === 'PICKUP');

    expect(pickups[0].baseId).toBe('urgent');
    expect(result.explanation.some((line) => line.includes('דחופות'))).toBe(true);
  });

  it('מחשב מרחק וזמן חיוביים ומסביר את ההצעה', () => {
    const result = service.suggest(hub, [
      pickup({ baseId: 'gdn', latitude: 32.02, longitude: 34.85, packageCount: 3 }),
      pickup({ baseId: 'tzr', latitude: 31.95, longitude: 34.83, packageCount: 2 }),
      pickup({ baseId: 'shl', latitude: 31.81, longitude: 34.72, packageCount: 1 }),
    ]);

    expect(result.totalDistanceKm).toBeGreaterThan(0);
    expect(result.totalDurationMinutes).toBeGreaterThan(0);
    expect(result.estimatedTripsSaved).toBe(2);
    expect(result.explanation.length).toBeGreaterThanOrEqual(2);
    expect(result.explanation.join(' ')).toContain('אופטימום מתמטי מובטח');
    expect(result.optimizationScore).toBeGreaterThan(0);
    expect(result.optimizationScore).toBeLessThanOrEqual(100);
  });

  it('שיפור 2-opt אינו מאריך את המסלול', () => {
    const pickups = [
      pickup({ baseId: 'a', latitude: 32.1, longitude: 34.9 }),
      pickup({ baseId: 'b', latitude: 31.5, longitude: 34.8 }),
      pickup({ baseId: 'c', latitude: 31.9, longitude: 34.85 }),
      pickup({ baseId: 'd', latitude: 31.7, longitude: 34.75 }),
    ];

    const optimized = service.suggest(hub, pickups);
    const manualOrder = service.metricsForOrder(hub, pickups);

    expect(optimized.totalDistanceKm).toBeLessThanOrEqual(manualOrder.totalDistanceKm + 0.01);
  });

  it('סדר ידני נשמר בדיוק כפי שנקבע', () => {
    const pickups = [
      pickup({ baseId: 'far', latitude: 32.2, longitude: 34.95 }),
      pickup({ baseId: 'close', latitude: 31.3, longitude: 34.8 }),
    ];

    const metrics = service.metricsForOrder(hub, pickups);

    expect(metrics.legs[0].toBaseName).toBe('far');
    expect(metrics.explanation[0]).toContain('ידנית');
  });

  it('כל עצירה מקבלת את מספר האריזות והדחיפות שלה', () => {
    const result = service.suggest(hub, [
      pickup({ baseId: 'gdn', packageCount: 5, highestPriority: TaskPriority.HIGH, longestWaitHours: 50 }),
    ]);

    const stop = result.stops.find((item) => item.stopType === 'PICKUP');
    expect(stop?.packageCount).toBe(5);
    expect(stop?.highestPriority).toBe(TaskPriority.HIGH);
    expect(stop?.longestWaitHours).toBe(50);
    expect(result.explanation.some((line) => line.includes('ימים'))).toBe(true);
  });
});
