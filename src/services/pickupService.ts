import type { PickupPoint, DeliveryServiceId, MapBounds } from '@/types/pickup';
import { mockPickupPoints } from '@/services/pickupMocks';

export async function getPickupPoints(
  provider: DeliveryServiceId,
  bounds: MapBounds,
): Promise<PickupPoint[]> {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return mockPickupPoints.filter((point) => point.provider === provider && isPointInBounds(point, bounds));
}

function isPointInBounds(point: PickupPoint, bounds: MapBounds) {
  const { southWest, northEast } = bounds;
  const withinLatitude = point.lat >= southWest.lat && point.lat <= northEast.lat;
  const withinLongitude = point.lng >= southWest.lng && point.lng <= northEast.lng;
  return withinLatitude && withinLongitude;
}
