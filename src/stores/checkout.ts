import { defineStore } from 'pinia';
import type { DeliveryQuote, DeliveryPvz, DeliveryType } from '@/types/delivery';
import type { DeliveryServiceId } from '@/types/pickup';

type DeliveryDraft = {
  provider: DeliveryServiceId;
  type: DeliveryType;
  pvzSearch: { city: string; query: string };
  pvzResults: DeliveryPvz[];
  pickup_point_id: string | null;
  pickup_point_address: string | null;
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
  calcLoading: boolean;
  calcError: string;
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
    calcLoading: false,
    calcError: '',
  }),
  actions: {
    resetQuote() {
      this.deliveryQuote = defaultQuote();
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
      this.deliveryDraft.pvzResults = [];
      this.pvzError = '';
      this.resetQuote();
      this.persistDraft();
    },
    setType(type: DeliveryType) {
      this.deliveryDraft.type = type;
      this.deliveryDraft.pickup_point_id = null;
      this.deliveryDraft.pickup_point_address = null;
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
      this.resetQuote();
      this.persistDraft();
    },
    clearPvzSelection() {
      this.deliveryDraft.pickup_point_id = null;
      this.deliveryDraft.pickup_point_address = null;
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
      this.calcError = '';
      this.persistQuote();
    },
    setCalcLoading(isLoading: boolean) {
      this.calcLoading = isLoading;
    },
    setCalcError(message: string) {
      this.calcError = message;
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
