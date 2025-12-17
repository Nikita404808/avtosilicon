import { defineStore } from 'pinia';
import { calculateDelivery } from '@/services/deliveryService';
import type { DeliveryQuote, DeliveryPvz, DeliveryType } from '@/types/delivery';
import type { DeliveryServiceId } from '@/types/pickup';

type DeliveryDraft = {
  provider: DeliveryServiceId;
  type: DeliveryType;
  pvzSearch: { city: string; query: string };
  pvzResults: DeliveryPvz[];
  pickup_point_id: string | null;
  pickup_point_address: string | null;
  provider_metadata: Record<string, unknown>;
  address: {
    region: string;
    city: string;
    postal_code: string;
    street: string;
    house: string;
    flat?: string;
  };
  recipient: {
    full_name: string;
    phone: string;
    email?: string;
  };
  comment: string;
};

type DeliveryState = {
  deliveryDraft: DeliveryDraft;
  deliveryQuote: DeliveryQuote;
  pvzLoading: boolean;
  pvzError: string;
  quoteLoading: boolean;
  quoteError: string;
  lastQuoteKey: string;
  calcLoading: boolean;
  calcError: string;
  quoteRequestSeq: number;
};

const STORAGE_KEY = 'deliveryDraft';
const QUOTE_KEY = 'deliveryQuote';

const defaultDraft = (): DeliveryDraft => ({
  provider: 'cdek',
  type: 'pvz',
  pvzSearch: { city: '', query: '' },
  pvzResults: [],
  pickup_point_id: null,
  pickup_point_address: null,
  provider_metadata: {},
  address: {
    region: '',
    city: '',
    postal_code: '',
    street: '',
    house: '',
    flat: '',
  },
  recipient: {
    full_name: '',
    phone: '',
    email: '',
  },
  comment: '',
});

const defaultQuote = (): DeliveryQuote => ({
  delivery_price: null,
  delivery_currency: null,
  delivery_eta: null,
  tariff_code: null,
  provider_metadata: null,
});

export function isReadyToQuote(draft: DeliveryDraft, totalWeight: number) {
  if (!draft.provider || !draft.type || totalWeight <= 0) return false;
  if (!draft.recipient.full_name?.trim() || !draft.recipient.phone?.trim()) return false;

  if (draft.provider === 'ruspost') {
    if (draft.type === 'pvz') {
      const pickupPointId = String(draft.pickup_point_id ?? '');
      return /^\d{5,6}$/.test(pickupPointId);
    }
    if (draft.type === 'door') {
      return Boolean(draft.address?.postal_code);
    }
  }

  if (draft.type === 'pvz') {
    if (!draft.pickup_point_id) return false;
    if (draft.provider === 'cdek') {
      const toCityCode = String((draft.provider_metadata as Record<string, unknown>)?.to_city_code ?? '');
      if (!toCityCode) return false;
    }
    return true;
  }

  const addr = draft.address;
  return Boolean(addr.region && addr.city && addr.postal_code && addr.street && addr.house);
}

export function createQuoteKey(draft: DeliveryDraft, totalWeight: number) {
  const provider = draft.provider ?? '';
  const type = draft.type ?? '';
  const pickupPointId = draft.pickup_point_id ?? '';
  const toCityCode = String((draft.provider_metadata as Record<string, unknown>)?.to_city_code ?? '');
  const postalCode = draft.address?.postal_code ?? '';
  const street = draft.address?.street ?? '';
  const house = draft.address?.house ?? '';
  return `${provider}|${type}|${totalWeight}|${pickupPointId}|${toCityCode}|${postalCode}|${street}|${house}`;
}

function loadPersistedDraft(): DeliveryDraft | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DeliveryDraft;
    return {
      ...defaultDraft(),
      ...parsed,
      pvzSearch: { ...defaultDraft().pvzSearch, ...(parsed?.pvzSearch ?? {}) },
      address: { ...defaultDraft().address, ...(parsed?.address ?? {}) },
      recipient: { ...defaultDraft().recipient, ...(parsed?.recipient ?? {}) },
      pvzResults: Array.isArray(parsed?.pvzResults) ? parsed.pvzResults : [],
    };
  } catch {
    return null;
  }
}

function loadPersistedQuote(): DeliveryQuote | null {
  try {
    const raw = localStorage.getItem(QUOTE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DeliveryQuote;
    return {
      ...defaultQuote(),
      ...parsed,
    };
  } catch {
    return null;
  }
}

export const useCheckoutStore = defineStore('checkout', {
  state: (): DeliveryState => ({
    deliveryDraft: loadPersistedDraft() ?? defaultDraft(),
    deliveryQuote: loadPersistedQuote() ?? defaultQuote(),
    pvzLoading: false,
    pvzError: '',
    quoteLoading: false,
    quoteError: '',
    lastQuoteKey: '',
    calcLoading: false,
    calcError: '',
    quoteRequestSeq: 0,
  }),
  actions: {
    resetQuote() {
      this.quoteRequestSeq += 1;
      this.deliveryQuote = defaultQuote();
      this.quoteLoading = false;
      this.calcLoading = false;
      this.quoteError = '';
      this.calcError = '';
      this.persistQuote();
    },
    resetDraft() {
      this.deliveryDraft = defaultDraft();
      this.resetQuote();
      this.persistDraft();
    },
    setProvider(provider: DeliveryServiceId) {
      this.deliveryDraft.provider = provider;
      this.clearPvzSelection();
      this.deliveryDraft.provider_metadata = {};
      this.deliveryDraft.pvzResults = [];
      this.pvzError = '';
      this.resetQuote();
      this.persistDraft();
    },
    setType(type: DeliveryType) {
      this.deliveryDraft.type = type;
      this.deliveryDraft.pickup_point_id = null;
      this.deliveryDraft.pickup_point_address = null;
      this.deliveryDraft.provider_metadata = {};
      this.deliveryDraft.pvzResults = [];
      this.pvzError = '';
      this.resetQuote();
      this.persistDraft();
    },
    setPvzSearchCity(city: string) {
      this.deliveryDraft.pvzSearch.city = city;
      this.resetQuote();
      this.persistDraft();
    },
    setPvzSearchQuery(query: string) {
      this.deliveryDraft.pvzSearch.query = query;
      this.resetQuote();
      this.persistDraft();
    },
    setPvzResults(points: DeliveryPvz[]) {
      this.deliveryDraft.pvzResults = points;
      this.persistDraft();
    },
    setPvzLoading(isLoading: boolean) {
      this.pvzLoading = isLoading;
    },
    setPvzError(message: string) {
      this.pvzError = message;
    },
    selectPvz(point: DeliveryPvz | null) {
      this.deliveryDraft.pickup_point_id = point?.id ?? null;
      this.deliveryDraft.pickup_point_address = point?.address ?? null;
      this.deliveryDraft.provider_metadata = {
        ...(this.deliveryDraft.provider_metadata ?? {}),
        ...(point?.city_code ? { to_city_code: point.city_code } : {}),
      };
      this.resetQuote();
      this.persistDraft();
    },
    setPickupPointId(value: string) {
      const normalized = typeof value === 'string' ? value.trim() : '';
      this.deliveryDraft.pickup_point_id = normalized || null;
      this.deliveryDraft.pickup_point_address = null;
      this.deliveryDraft.provider_metadata = {};
      this.resetQuote();
      this.persistDraft();
    },
    clearPvzSelection() {
      this.deliveryDraft.pickup_point_id = null;
      this.deliveryDraft.pickup_point_address = null;
      this.deliveryDraft.provider_metadata = {};
    },
    updateAddressField(field: keyof DeliveryDraft['address'], value: string) {
      this.deliveryDraft.address[field] = value;
      this.resetQuote();
      this.persistDraft();
    },
    updateRecipientField(field: keyof DeliveryDraft['recipient'], value: string) {
      this.deliveryDraft.recipient[field] = value;
      this.persistDraft();
    },
    setComment(value: string) {
      this.deliveryDraft.comment = value;
      this.persistDraft();
    },
    setDeliveryQuote(quote: DeliveryQuote) {
      this.deliveryQuote = { ...defaultQuote(), ...quote };
      this.quoteError = '';
      this.calcError = '';
      this.persistQuote();
    },
    buildQuoteKey(totalWeight: number) {
      return createQuoteKey(this.deliveryDraft, totalWeight);
    },
    async calculateQuote(totalWeight: number, options?: { signal?: AbortSignal; force?: boolean }) {
      if (!isReadyToQuote(this.deliveryDraft, totalWeight)) return;

      const quoteKey = createQuoteKey(this.deliveryDraft, totalWeight);
      if (!options?.force && this.lastQuoteKey === quoteKey && this.deliveryQuote.delivery_price !== null) {
        return;
      }

      this.quoteRequestSeq += 1;
      const requestSeq = this.quoteRequestSeq;

      this.quoteLoading = true;
      this.calcLoading = true;
      this.quoteError = '';
      this.calcError = '';

      try {
        const payload = {
          provider: this.deliveryDraft.provider,
          type: this.deliveryDraft.type,
          total_weight: totalWeight,
          pickup_point_id: this.deliveryDraft.type === 'pvz' ? this.deliveryDraft.pickup_point_id : undefined,
          address: this.deliveryDraft.type === 'door' ? this.deliveryDraft.address : undefined,
          provider_metadata: Object.keys(this.deliveryDraft.provider_metadata ?? {}).length
            ? this.deliveryDraft.provider_metadata
            : undefined,
        };
        const quote = await calculateDelivery(payload, { signal: options?.signal });
        if (requestSeq !== this.quoteRequestSeq) return;
        this.setDeliveryQuote(quote);
        this.lastQuoteKey = quoteKey;
      } catch (error) {
        if (requestSeq !== this.quoteRequestSeq) return;
        const isAbort =
          (error instanceof DOMException && error.name === 'AbortError') ||
          (error instanceof Error && error.name === 'AbortError');
        if (isAbort) return;
        const message = error instanceof Error ? error.message : 'Не удалось рассчитать доставку, попробуйте позже.';
        this.quoteError = message;
        this.calcError = message;
      } finally {
        if (requestSeq === this.quoteRequestSeq) {
          this.quoteLoading = false;
          this.calcLoading = false;
        }
      }
    },
    setQuoteLoading(isLoading: boolean) {
      this.quoteLoading = isLoading;
      this.calcLoading = isLoading;
    },
    setQuoteError(message: string) {
      this.quoteError = message;
      this.calcError = message;
    },
    setCalcLoading(isLoading: boolean) {
      this.setQuoteLoading(isLoading);
    },
    setCalcError(message: string) {
      this.setQuoteError(message);
    },
    persistDraft() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.deliveryDraft));
      } catch (error) {
        console.warn('[Checkout] Failed to persist draft', error);
      }
    },
    persistQuote() {
      try {
        localStorage.setItem(QUOTE_KEY, JSON.stringify(this.deliveryQuote));
      } catch (error) {
        console.warn('[Checkout] Failed to persist quote', error);
      }
    },
  },
});
