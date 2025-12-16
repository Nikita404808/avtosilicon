import type { DeliveryServiceId, PickupPoint } from './pickup';

export type DeliveryType = 'pvz' | 'door';

export type DeliveryAddress = {
  region: string;
  city: string;
  postal_code: string;
  street: string;
  house: string;
  flat?: string;
};

export type DeliveryRecipient = {
  full_name: string;
  phone: string;
  email?: string;
};

export type DeliveryCalculationPayload = {
  provider: DeliveryServiceId;
  type: DeliveryType;
  total_weight: number;
  pickup_point_id?: string;
  address?: DeliveryAddress;
};

export type DeliveryQuote = {
  delivery_price: number | null;
  delivery_currency: string | null;
  delivery_eta: string | null;
  tariff_code?: string | number | null;
  provider_metadata?: Record<string, unknown> | null;
};

export type DeliveryDetails = DeliveryCalculationPayload &
  DeliveryQuote & {
    pickup_point_address?: string;
    recipient: DeliveryRecipient;
    comment?: string;
  };

export type DeliveryPvz = {
  id: string;
  name: string;
  address: string;
  lat?: number;
  lon?: number;
  lng?: number;
  provider: DeliveryServiceId;
};

export type DeliveryCalculateResponse = DeliveryQuote;

export type DeliveryPvzSearchResponse = {
  points: PickupPoint[] | DeliveryPvz[];
};
