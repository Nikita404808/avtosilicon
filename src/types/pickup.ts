export type DeliveryServiceId = 'pochta' | 'cdek' | 'yandex';

export type PickupPoint = {
  id: string;
  provider: DeliveryServiceId;
  name: string;
  address: string;
  lat: number;
  lng: number;
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
