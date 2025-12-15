import { defineStore } from 'pinia';
import type {
  AddressReference,
  Money,
  OrderSummary,
  UserProfile,
  PointsHistoryItem,
  OrderLine,
  Product,
  OrderBonusInfo,
} from '@/types';
import productsMock from '@/mocks/products.json';
import { useCartStore } from './cart';

const fallbackProducts = (productsMock as Array<Record<string, unknown>>).map(normalizeMockProduct);
const AUTH_API_BASE = import.meta.env.VITE_AUTH_API_BASE ?? 'http://79.174.85.129:3000';

type UserState = {
  profile: UserProfile | null;
  addresses: AddressReference[];
  orderHistory: OrderSummary[];
  pointsHistory: PointsHistoryItem[];
  selectedAddressId: string | null;
  isLoadingProfile: boolean;
  isLoadingAddresses: boolean;
  isLoadingOrders: boolean;
  authToken: string | null;
};

type BankApiResponse<T> = {
  data: T;
};

type RepeatOrderPayload = {
  orderId: string;
};

type AddressLinkResponse = {
  redirectUrl: string;
};

type AddressConfirmationPayload = {
  addressToken: string;
};

const BANK_API_BASE = import.meta.env.VITE_BANK_API_BASE ?? '';
type OrdersApiRow = {
  id: string | number;
  order_data: OrderSummary | null;
  created_at: string;
  bonus_spent?: number | null;
  bonus_earned?: number | null;
  payable_amount?: number | null;
};

type AuthApiSuccess = {
  success: boolean;
};

type CreateOrderResponse = AuthApiSuccess & {
  orderId: string | number | null;
  usedBonus: number;
  bonusEarned: number;
  payable: number;
  newBonusBalance: number;
};

type CreateOrderResult =
  | { status: 'unauthorized' }
  | ({ status: 'success' } & CreateOrderResponse);

type HttpError = Error & { status?: number };

const createDefaultState = (): UserState => ({
  profile: null,
  addresses: [],
  orderHistory: [],
  pointsHistory: [],
  selectedAddressId: null,
  isLoadingProfile: false,
  isLoadingAddresses: false,
  isLoadingOrders: false,
  authToken: null,
});

async function requestBankApi<T>(path: string, options?: RequestInit): Promise<T> {
  if (!BANK_API_BASE) {
    throw new Error('BANK_API_BASE is not configured');
  }

  const response = await fetch(`${BANK_API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Bank API request failed');
  }

  const payload = (await response.json()) as BankApiResponse<T>;
  return payload.data;
}

export const useUserStore = defineStore('user', {
  state: createDefaultState,
  getters: {
    isAuthenticated: (state) => Boolean(state.profile?.id),
    loyaltyPoints: (state) =>
      state.profile?.bonusBalance ?? state.profile?.loyaltyPoints ?? 0,
    bonusBalance: (state) =>
      state.profile?.bonusBalance ?? state.profile?.loyaltyPoints ?? 0,
  },
  actions: {
    reset() {
      Object.assign(this, createDefaultState());
    },
    setAuthToken(token: string | null) {
      this.authToken = token;
    },
    setProfileFromAuth(
      user:
        | {
            id: string;
            email: string;
            name?: string | null;
            emailVerified?: boolean;
            bonusBalance?: number;
            bonus_balance?: number;
          }
        | null,
    ) {
      if (!user) {
        this.profile = null;
        return;
      }

      const bonusBalance = normalizeBonusBalance(
        user.bonusBalance ?? (user as Record<string, unknown>).bonus_balance ?? this.loyaltyPoints,
      );

      this.profile = {
        id: user.id,
        email: user.email,
        name: user.name ?? formatNameFromEmail(user.email),
        phone: this.profile?.phone,
        loyaltyPoints: bonusBalance,
        bonusBalance,
        emailVerified: user.emailVerified ?? this.profile?.emailVerified ?? false,
      };
    },
    async fetchProfile() {
      this.isLoadingProfile = true;
      try {
        const { useAuthStore } = await import('./auth');
        const authStore = useAuthStore();
        this.setProfileFromAuth(authStore.user);
      } catch (error) {
        console.error('[User] Failed to sync profile from auth store', error);
      } finally {
        this.isLoadingProfile = false;
      }
    },
    async updateProfile(patch: Partial<UserProfile>) {
      if (!this.authToken || !this.profile?.id) return;
      this.isLoadingProfile = true;
      try {
        const updated = await requestBankApi<UserProfile>(`/users/${this.profile.id}`, {
          method: 'PATCH',
          body: JSON.stringify(patch),
          headers: { Authorization: `Bearer ${this.authToken}` },
        });
        this.profile = {
          ...this.profile!,
          ...updated,
          bonusBalance: this.profile?.bonusBalance,
          loyaltyPoints: this.profile?.loyaltyPoints,
        };
      } catch (error) {
        logBankError(error);
        this.profile = { ...this.profile!, ...patch };
      } finally {
        this.isLoadingProfile = false;
      }
    },
    async updateName(name: string) {
      if (!this.authToken) throw new Error('Требуется авторизация');
      const trimmed = name.trim();
      if (!trimmed || trimmed.length > 100) {
        throw new Error('Введите корректное имя.');
      }
      await requestAuthApi<AuthApiSuccess>('/api/users/me/name', this.authToken, {
        method: 'PUT',
        body: JSON.stringify({ name: trimmed }),
      });
      if (this.profile) {
        this.profile.name = trimmed;
      }
      const { useAuthStore } = await import('./auth');
      useAuthStore().patchUser({ name: trimmed });
    },
    async fetchAddresses() {
      if (!this.authToken) return;
      this.isLoadingAddresses = true;
      try {
        const addresses = await requestBankApi<AddressReference[]>('/users/me/addresses', {
          headers: { Authorization: `Bearer ${this.authToken}` },
        });
        this.addresses = addresses;
      } catch (error) {
        logBankError(error);
        if (!this.addresses.length) {
          this.addresses = [
            {
              id: 'demo-address',
              label: 'г. Москва, ул. Промышленная, 12',
              lastSyncedAt: new Date().toISOString(),
              isDefault: true,
              details: {
                receiver: 'Иван Иванов',
                phone: '+7 (900) 111-22-33',
                addressLine: 'Москва, Промышленная 12, офис 4',
                comment: 'Позвонить за 30 минут',
              },
            },
          ];
          this.selectedAddressId = 'demo-address';
        }
      } finally {
        this.isLoadingAddresses = false;
      }
    },
    async startAddressBinding() {
      if (!this.authToken) return null;
      try {
        const { redirectUrl } = await requestBankApi<AddressLinkResponse>(
          '/users/me/addresses/session',
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${this.authToken}` },
          },
        );
        return redirectUrl;
      } catch (error) {
        logBankError(error);
        return null;
      }
    },
    async addAddress(payload: AddressConfirmationPayload) {
      if (!this.authToken) return;
      this.isLoadingAddresses = true;
      try {
        const address = await requestBankApi<AddressReference>('/users/me/addresses', {
          method: 'POST',
          body: JSON.stringify(payload),
          headers: { Authorization: `Bearer ${this.authToken}` },
        });
        const exists = this.addresses.some((item) => item.id === address.id);
        this.addresses = exists ? this.addresses : [...this.addresses, address];
        if (!this.selectedAddressId) {
          this.selectedAddressId = address.id;
        }
      } catch (error) {
        logBankError(error);
        const mockId = `mock-${Date.now()}`;
        this.addresses.push({
          id: mockId,
          label: 'Новый адрес (тестовый)',
          lastSyncedAt: new Date().toISOString(),
          isDefault: this.addresses.length === 0,
        });
        this.selectedAddressId = mockId;
      } finally {
        this.isLoadingAddresses = false;
      }
    },
    async removeAddress(addressId: string) {
      if (!this.authToken) return;
      this.isLoadingAddresses = true;
      try {
        await requestBankApi<void>(`/users/me/addresses/${addressId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${this.authToken}` },
        });
        this.addresses = this.addresses.filter((item) => item.id !== addressId);
        if (this.selectedAddressId === addressId) {
          this.selectedAddressId = this.addresses[0]?.id ?? null;
        }
      } catch (error) {
        logBankError(error);
      } finally {
        this.isLoadingAddresses = false;
      }
    },
    setDefaultAddress(addressId: string) {
      this.addresses = this.addresses.map((address) => ({
        ...address,
        isDefault: address.id === addressId,
      }));
      this.selectedAddressId = addressId;
    },
    async fetchOrders() {
      if (!this.authToken) return;
      this.isLoadingOrders = true;
      try {
        const orders = await requestAuthApi<OrdersApiRow[]>('/api/orders', this.authToken);
        this.orderHistory = orders.map(normalizeOrderRow);
      } catch (error) {
        logAuthError(error);
      } finally {
        this.isLoadingOrders = false;
      }
    },
    async createOrder(order: Record<string, unknown>, useBonuses: boolean): Promise<CreateOrderResult> {
      if (!this.authToken) return { status: 'unauthorized' as const };
      try {
        const response = await requestAuthApi<CreateOrderResponse>('/api/orders', this.authToken, {
          method: 'POST',
          body: JSON.stringify({ order, useBonuses }),
        });
        this.applyBonusBalance(response.newBonusBalance);
        await this.fetchOrders();
        return { status: 'success' as const, ...response };
      } catch (error) {
        if (isHttpError(error) && (error.status === 401 || error.status === 403)) {
          return { status: 'unauthorized' as const };
        }
        throw error;
      }
    },
    applyBonusBalance(balance: number | null | undefined) {
      if (!this.profile) return;
      const normalized = normalizeBonusBalance(balance);
      this.profile.bonusBalance = normalized;
      this.profile.loyaltyPoints = normalized;
      import('./auth')
        .then(({ useAuthStore }) => {
          useAuthStore().patchUser({ bonusBalance: normalized });
        })
        .catch((error) => {
          console.warn('[User] Failed to sync bonus balance to auth store', error);
        });
    },
    async repeatOrder(payload: RepeatOrderPayload) {
      if (!this.authToken) return;
      const cartStore = useCartStore();
      const order = this.orderHistory.find((item) => item.id === payload.orderId);
      if (order) {
        order.items.forEach((line) => {
          const price = toMoney(line.price?.amount ?? 0);
          cartStore.addItem({
            productId: String(line.productId),
            title: line.title,
            quantity: line.quantity,
            price,
          });
        });
        cartStore.toggleCart(true);
      }
      try {
        await requestBankApi<OrderLine[]>(`/users/me/orders/${payload.orderId}/repeat`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.authToken}` },
        });
      } catch (error) {
        logBankError(error);
      }
    },
    redeemPoints(amount: number) {
      if (!this.profile) return;
      if (amount <= 0) return;
      const currentBalance = this.profile.bonusBalance ?? this.profile.loyaltyPoints ?? 0;
      if (amount > currentBalance) {
        throw new Error('Недостаточно баллов');
      }
      const nextBalance = normalizeBonusBalance(currentBalance - amount);
      this.profile.bonusBalance = nextBalance;
      this.profile.loyaltyPoints = nextBalance;
      this.pointsHistory.unshift({
        id: `redeem-${Date.now()}`,
        type: 'spend',
        amount,
        description: 'Списание баллов по запросу пользователя',
        createdAt: new Date().toISOString(),
      });
    },
    accruePoints(amount: number, description: string) {
      if (!this.profile || amount <= 0) return;
      const currentBalance = this.profile.bonusBalance ?? this.profile.loyaltyPoints ?? 0;
      const nextBalance = normalizeBonusBalance(currentBalance + amount);
      this.profile.bonusBalance = nextBalance;
      this.profile.loyaltyPoints = nextBalance;
      this.pointsHistory.unshift({
        id: `earn-${Date.now()}`,
        type: 'earn',
        amount,
        description,
        createdAt: new Date().toISOString(),
      });
    },
    assignAddressToOrder(orderId: string, addressId: string) {
      this.orderHistory = this.orderHistory.map((order) =>
        order.id === orderId ? { ...order, shippingAddressId: addressId } : order,
      );
    },
  },
});

function logBankError(error: unknown) {
  console.error('[Bank API]', error);
}

function logAuthError(error: unknown) {
  console.error('[Auth API]', error);
}

function findProduct(productId: string) {
  return fallbackProducts.find(
    (product) => product.legacyId === productId || String(product.id) === productId,
  );
}

function buildFallbackOrderItems(items: { productId: string; quantity: number }[]): OrderLine[] {
  return items
    .map((line) => {
      const product = findProduct(line.productId);
      if (!product) return null;
      return {
        productId: String(product.id),
        title: product.title,
        quantity: line.quantity,
        price: toMoney(product.price),
      };
    })
    .filter(Boolean) as OrderLine[];
}

function toMoney(amount: number | null | undefined): Money {
  if (typeof amount === 'number' && Number.isFinite(amount)) {
    return { amount, currency: 'RUB' };
  }
  return { amount: 0, currency: 'RUB' };
}

function normalizeMockProduct(raw: Record<string, unknown>, index: number): Product {
  const rawId = raw.id;
  const legacyId = typeof rawId === 'string' ? rawId : null;
  const numericId = typeof rawId === 'number' ? rawId : index + 1;
  const title =
    typeof raw.title === 'string'
      ? raw.title
      : typeof raw.name === 'string'
        ? raw.name
        : `Товар ${index + 1}`;
  const images = Array.isArray(raw.images)
    ? (raw.images as unknown[]).filter((item): item is string => typeof item === 'string')
    : [];
  const priceValue =
    typeof raw.price === 'object' && raw.price !== null && 'amount' in raw.price
      ? Number((raw.price as { amount: number }).amount)
      : typeof raw.price === 'number'
        ? raw.price
        : null;

  const carModelName = typeof raw.carModel === 'string' ? raw.carModel : null;
  const carModel = carModelName
    ? {
        id: carModelName,
        name: carModelName,
        image: typeof raw.carModelImage === 'string' ? raw.carModelImage : null,
      }
    : null;
  const partTypeName = typeof raw.partType === 'string' ? raw.partType : null;
  const partType = partTypeName
    ? {
        id: partTypeName,
        name: partTypeName,
      }
    : null;

  return {
    id: numericId,
    legacyId,
    slug: typeof raw.slug === 'string' ? raw.slug : `${numericId}`,
    name: title,
    title,
    sku: typeof raw.sku === 'string' ? raw.sku : null,
    price: typeof priceValue === 'number' && Number.isFinite(priceValue) ? priceValue : null,
    brand: typeof raw.brand === 'string' ? raw.brand : null,
    carModel,
    partType,
    description: typeof raw.description === 'string' ? raw.description : null,
    descriptionHtml: typeof raw.descriptionHtml === 'string' ? raw.descriptionHtml : '',
    image: images[0] ?? null,
    images,
    innerDiameter:
      typeof raw.innerDiameter === 'number'
        ? raw.innerDiameter
        : typeof raw.innerDiameter === 'string'
          ? raw.innerDiameter.trim() || null
          : null,
    inStock: typeof raw.inStock === 'boolean' ? raw.inStock : true,
    categories: Array.isArray(raw.categories)
      ? (raw.categories as unknown[]).filter((item): item is string => typeof item === 'string')
      : [],
    code: typeof raw.code === 'string' ? raw.code : null,
    material: typeof raw.material === 'string' ? raw.material : null,
    color: typeof raw.color === 'string' ? raw.color : null,
    series: typeof raw.series === 'string' ? raw.series : null,
    transportType: typeof raw.transportType === 'string' ? raw.transportType : null,
    barcode: typeof raw.barcode === 'string' ? raw.barcode : null,
    weight:
      typeof raw.weight === 'number'
        ? raw.weight
        : typeof raw.weight === 'string'
          ? raw.weight.trim() || null
          : typeof raw.weightKg === 'number'
            ? raw.weightKg
            : typeof raw.weightKg === 'string'
              ? raw.weightKg.trim() || null
              : null,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : null,
    isNew: Boolean(raw.isNew),
  };
}

function formatNameFromEmail(email: string) {
  return email.split('@')[0] || email;
}

async function requestAuthApi<T>(path: string, token: string, options?: RequestInit): Promise<T> {
  if (!AUTH_API_BASE) {
    throw new Error('AUTH_API_BASE is not configured');
  }
  const response = await fetch(`${AUTH_API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw createHttpError(response.status, message || 'Auth API request failed');
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json() as Promise<T>;
}

function createHttpError(status: number, message: string): HttpError {
  const error = new Error(message) as HttpError;
  error.status = status;
  return error;
}

function isHttpError(error: unknown): error is HttpError {
  return Boolean(error) && typeof error === 'object' && 'status' in (error as Record<string, unknown>);
}

function normalizeOrderRow(record: OrdersApiRow): OrderSummary {
  const payload = record.order_data ?? {
    id: String(record.id),
    number: `ORDER-${record.id}`,
    createdAt: record.created_at,
    status: 'processing',
    total: { amount: 0, currency: 'RUB' },
    items: [],
  };
  const bonusFromPayload = (payload as Record<string, unknown> & { bonus?: OrderBonusInfo }).bonus;
  const normalized: OrderSummary = {
    ...payload,
    id: String(payload.id ?? record.id),
    createdAt: payload.createdAt ?? record.created_at,
    total: normalizeMoney(payload.total),
  };

  const bonus = bonusFromPayload ?? extractBonusFromRow(record);
  if (bonus) {
    normalized.bonus = bonus;
  }

  return normalized;
}

function extractBonusFromRow(record: OrdersApiRow): OrderBonusInfo | undefined {
  const spent = Number(record.bonus_spent);
  const earned = Number(record.bonus_earned);
  const payable = Number(record.payable_amount);

  const hasBonusData = [spent, earned, payable].some((value) => Number.isFinite(value) && value > 0);
  if (!hasBonusData) return undefined;

  return {
    spent: normalizeBonusBalance(spent),
    earned: normalizeBonusBalance(earned),
    payable: normalizeBonusBalance(payable),
  };
}

function normalizeMoney(value: Money | null | undefined): Money {
  const amount = Number(value?.amount);
  return {
    amount: Number.isFinite(amount) ? amount : 0,
    currency: 'RUB',
  };
}

function normalizeBonusBalance(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return Math.max(0, Math.floor(numeric));
}
