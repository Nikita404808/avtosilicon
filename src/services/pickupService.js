import { mockPickupPoints } from '@/services/pickupMocks';
export async function getPickupPoints(provider, bounds) {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return mockPickupPoints.filter((point) => point.provider === provider && isPointInBounds(point, bounds));
}
function isPointInBounds(point, bounds) {
    const { southWest, northEast } = bounds;
    const lat = point.lat ?? 0;
    const lng = point.lng ?? point.lon ?? 0;
    const withinLatitude = lat >= southWest.lat && lat <= northEast.lat;
    const withinLongitude = lng >= southWest.lng && lng <= northEast.lng;
    return withinLatitude && withinLongitude;
}
