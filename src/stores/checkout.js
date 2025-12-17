import { defineStore } from 'pinia';
import { calculateDelivery } from '@/services/deliveryService';
const STORAGE_KEY = 'deliveryDraft';
const QUOTE_KEY = 'deliveryQuote';
const defaultDraft = () => ({
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
const defaultQuote = () => ({
    delivery_price: null,
    delivery_currency: null,
    delivery_eta: null,
    tariff_code: null,
    provider_metadata: null,
});
export function isReadyToQuote(draft, totalWeight) {
    if (!draft.provider || !draft.type || totalWeight <= 0)
        return false;
    if (!draft.recipient.full_name?.trim() || !draft.recipient.phone?.trim())
        return false;
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
        if (!draft.pickup_point_id)
            return false;
        if (draft.provider === 'cdek') {
            const toCityCode = String(draft.provider_metadata?.to_city_code ?? '');
            if (!toCityCode)
                return false;
        }
        return true;
    }
    const addr = draft.address;
    return Boolean(addr.region && addr.city && addr.postal_code && addr.street && addr.house);
}
export function createQuoteKey(draft, totalWeight) {
    const provider = draft.provider ?? '';
    const type = draft.type ?? '';
    const pickupPointId = draft.pickup_point_id ?? '';
    const toCityCode = String(draft.provider_metadata?.to_city_code ?? '');
    const postalCode = draft.address?.postal_code ?? '';
    const street = draft.address?.street ?? '';
    const house = draft.address?.house ?? '';
    return `${provider}|${type}|${totalWeight}|${pickupPointId}|${toCityCode}|${postalCode}|${street}|${house}`;
}
function loadPersistedDraft() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw)
            return null;
        const parsed = JSON.parse(raw);
        return {
            ...defaultDraft(),
            ...parsed,
            pvzSearch: { ...defaultDraft().pvzSearch, ...(parsed?.pvzSearch ?? {}) },
            address: { ...defaultDraft().address, ...(parsed?.address ?? {}) },
            recipient: { ...defaultDraft().recipient, ...(parsed?.recipient ?? {}) },
            pvzResults: Array.isArray(parsed?.pvzResults) ? parsed.pvzResults : [],
        };
    }
    catch {
        return null;
    }
}
function loadPersistedQuote() {
    try {
        const raw = localStorage.getItem(QUOTE_KEY);
        if (!raw)
            return null;
        const parsed = JSON.parse(raw);
        return {
            ...defaultQuote(),
            ...parsed,
        };
    }
    catch {
        return null;
    }
}
export const useCheckoutStore = defineStore('checkout', {
    state: () => ({
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
        setProvider(provider) {
            this.deliveryDraft.provider = provider;
            this.clearPvzSelection();
            this.deliveryDraft.provider_metadata = {};
            this.deliveryDraft.pvzResults = [];
            this.pvzError = '';
            this.resetQuote();
            this.persistDraft();
        },
        setType(type) {
            this.deliveryDraft.type = type;
            this.deliveryDraft.pickup_point_id = null;
            this.deliveryDraft.pickup_point_address = null;
            this.deliveryDraft.provider_metadata = {};
            this.deliveryDraft.pvzResults = [];
            this.pvzError = '';
            this.resetQuote();
            this.persistDraft();
        },
        setPvzSearchCity(city) {
            this.deliveryDraft.pvzSearch.city = city;
            this.resetQuote();
            this.persistDraft();
        },
        setPvzSearchQuery(query) {
            this.deliveryDraft.pvzSearch.query = query;
            this.resetQuote();
            this.persistDraft();
        },
        setPvzResults(points) {
            this.deliveryDraft.pvzResults = points;
            this.persistDraft();
        },
        setPvzLoading(isLoading) {
            this.pvzLoading = isLoading;
        },
        setPvzError(message) {
            this.pvzError = message;
        },
        selectPvz(point) {
            this.deliveryDraft.pickup_point_id = point?.id ?? null;
            this.deliveryDraft.pickup_point_address = point?.address ?? null;
            this.deliveryDraft.provider_metadata = {
                ...(this.deliveryDraft.provider_metadata ?? {}),
                ...(point?.city_code ? { to_city_code: point.city_code } : {}),
            };
            this.resetQuote();
            this.persistDraft();
        },
        setPickupPointId(value) {
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
        updateAddressField(field, value) {
            this.deliveryDraft.address[field] = value;
            this.resetQuote();
            this.persistDraft();
        },
        updateRecipientField(field, value) {
            this.deliveryDraft.recipient[field] = value;
            this.persistDraft();
        },
        setComment(value) {
            this.deliveryDraft.comment = value;
            this.persistDraft();
        },
        setDeliveryQuote(quote) {
            this.deliveryQuote = { ...defaultQuote(), ...quote };
            this.quoteError = '';
            this.calcError = '';
            this.persistQuote();
        },
        buildQuoteKey(totalWeight) {
            return createQuoteKey(this.deliveryDraft, totalWeight);
        },
        async calculateQuote(totalWeight, options) {
            if (!isReadyToQuote(this.deliveryDraft, totalWeight))
                return;
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
                if (requestSeq !== this.quoteRequestSeq)
                    return;
                this.setDeliveryQuote(quote);
                this.lastQuoteKey = quoteKey;
            }
            catch (error) {
                if (requestSeq !== this.quoteRequestSeq)
                    return;
                const isAbort = (error instanceof DOMException && error.name === 'AbortError') ||
                    (error instanceof Error && error.name === 'AbortError');
                if (isAbort)
                    return;
                const message = error instanceof Error ? error.message : 'Не удалось рассчитать доставку, попробуйте позже.';
                this.quoteError = message;
                this.calcError = message;
            }
            finally {
                if (requestSeq === this.quoteRequestSeq) {
                    this.quoteLoading = false;
                    this.calcLoading = false;
                }
            }
        },
        setQuoteLoading(isLoading) {
            this.quoteLoading = isLoading;
            this.calcLoading = isLoading;
        },
        setQuoteError(message) {
            this.quoteError = message;
            this.calcError = message;
        },
        setCalcLoading(isLoading) {
            this.setQuoteLoading(isLoading);
        },
        setCalcError(message) {
            this.setQuoteError(message);
        },
        persistDraft() {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(this.deliveryDraft));
            }
            catch (error) {
                console.warn('[Checkout] Failed to persist draft', error);
            }
        },
        persistQuote() {
            try {
                localStorage.setItem(QUOTE_KEY, JSON.stringify(this.deliveryQuote));
            }
            catch (error) {
                console.warn('[Checkout] Failed to persist quote', error);
            }
        },
    },
});
