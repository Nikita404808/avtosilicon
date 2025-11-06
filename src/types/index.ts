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

export type Product = {
  id: string;
  slug: string;
  title: string;
  price: Money;
  images: string[];
  sku?: string;
  code?: string;
  material?: string;
  series?: string;
  transportType?: string;
  barcode?: string;
  weightKg?: number;
  categories: string[];
  compatibility: string[];
  descriptionHtml?: string;
};

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
