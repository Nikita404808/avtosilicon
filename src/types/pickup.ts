export type DeliveryServiceId = 'cdek' | 'ruspost' | 'yandex';

export type PickupPoint = {
  id: string;
  provider: DeliveryServiceId;
  name: string;
  address: string;
  lat?: number;
  lon?: number;
  lng?: number;
};

export type MapBounds = {
  southWest: {
    lat: number;
    lng: number;
  };
  northEast: {
    lat: number;
    lng: number;
  };
};
