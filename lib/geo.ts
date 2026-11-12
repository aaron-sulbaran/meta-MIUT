const EARTH_RADIUS_METERS = 6_371_000;
const WALKING_METERS_PER_MINUTE = 80;

type Point = { lat: number; lng: number };

export function distanceMeters(from: Point, to: Point): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const deltaLat = toRadians(to.lat - from.lat);
  const deltaLng = toRadians(to.lng - from.lng);
  const haversine =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(deltaLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(haversine));
}

export function walkMinutes(from: Point, to: Point): number {
  return Math.max(1, Math.round(distanceMeters(from, to) / WALKING_METERS_PER_MINUTE));
}
