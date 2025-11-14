export type Money = {
  amount: number;
  currency: 'RUB';
};

export type OrderLine = {
  productId: string;
  title: string;
  quantity: number;
  price: Money;
};

export type { Product } from '@/api/directus';

export type FilterState = {
  q?: string;
  make?: string;
  model?: string;
  categories?: string[];
  page?: number;
};

export type UserProfile = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  loyaltyPoints?: number;
  emailVerified?: boolean;
};

export type AddressReference = {
  id: string;
  label: string;
  lastSyncedAt?: string;
  isDefault?: boolean;
  details?: {
    receiver?: string;
    phone?: string;
    addressLine?: string;
    comment?: string;
  };
};

export type OrderSummary = {
  id: string;
  number: string;
  createdAt: string;
  status: 'delivered' | 'processing' | 'cancelled';
  total: Money;
  items: OrderLine[];
  shippingAddressId?: string;
};

export type PointsHistoryItem = {
  id: string;
  type: 'earn' | 'spend';
  amount: number;
  description: string;
  createdAt: string;
};
