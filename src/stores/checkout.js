import { defineStore } from 'pinia';
const STORAGE_KEY = 'deliveryDraft';
const QUOTE_KEY = 'deliveryQuote';
const defaultDraft = () => ({
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
const defaultQuote = () => ({
    delivery_price: null,
    delivery_currency: null,
    delivery_eta: null,
    tariff_code: null,
    provider_metadata: null,
});
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
        setProvider(provider) {
            this.deliveryDraft.provider = provider;
            this.clearPvzSelection();
            this.deliveryDraft.pvzResults = [];
            this.pvzError = '';
            this.resetQuote();
            this.persistDraft();
        },
        setType(type) {
            this.deliveryDraft.type = type;
            this.deliveryDraft.pickup_point_id = null;
            this.deliveryDraft.pickup_point_address = null;
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
            this.resetQuote();
            this.persistDraft();
        },
        clearPvzSelection() {
            this.deliveryDraft.pickup_point_id = null;
            this.deliveryDraft.pickup_point_address = null;
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
            this.calcError = '';
            this.persistQuote();
        },
        setCalcLoading(isLoading) {
            this.calcLoading = isLoading;
        },
        setCalcError(message) {
            this.calcError = message;
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
