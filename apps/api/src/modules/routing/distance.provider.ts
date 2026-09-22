import { Injectable } from '@nestjs/common';
import { EARTH_RADIUS_KM } from '@south/shared';

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

/**
 * Adapter לחישוב מרחקים.
 * ברירת המחדל היא Haversine על נקודות הציון שב-Seed, בלי תלות בשירות חיצוני.
 * החלפה לשירות מפות בעתיד היא החלפת מימוש אחד בלבד (§9).
 */
export interface DistanceProvider {
  readonly name: string;
  distanceKm(from: GeoPoint, to: GeoPoint): number;
}

export const DISTANCE_PROVIDER = 'DISTANCE_PROVIDER';

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

@Injectable()
export class HaversineDistanceProvider implements DistanceProvider {
  readonly name = 'haversine';

  distanceKm(from: GeoPoint, to: GeoPoint): number {
    const dLat = toRadians(to.latitude - from.latitude);
    const dLon = toRadians(to.longitude - from.longitude);
    const lat1 = toRadians(from.latitude);
    const lat2 = toRadians(to.latitude);

    const a =
      Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return EARTH_RADIUS_KM * c;
  }
}
