import { mockPickupPoints } from '@/services/pickupMocks';
export async function getPickupPoints(provider, bounds) {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return mockPickupPoints.filter((point) => point.provider === provider && isPointInBounds(point, bounds));
}
function isPointInBounds(point, bounds) {
    const { southWest, northEast } = bounds;
    const withinLatitude = point.lat >= southWest.lat && point.lat <= northEast.lat;
    const withinLongitude = point.lng >= southWest.lng && point.lng <= northEast.lng;
    return withinLatitude && withinLongitude;
}
