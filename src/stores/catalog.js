import { defineStore } from 'pinia';
const defaultState = () => ({
    products: [],
    filters: {
        categories: [],
        page: 1,
    },
    total: 0,
    pageSize: 12,
    isLoading: false,
});
export const useCatalogStore = defineStore('catalog', {
    state: defaultState,
    getters: {
        totalPages: (state) => Math.max(1, Math.ceil(state.total / state.pageSize)),
        activeCategories: (state) => state.filters.categories ?? [],
    },
    actions: {
        setFilters(payload) {
            this.filters = {
                ...this.filters,
                ...payload,
                categories: payload.categories ?? this.filters.categories,
            };
        },
        setProducts(products, total) {
            this.products = products;
            if (typeof total === 'number') {
                this.total = total;
            }
            else {
                this.total = products.length;
            }
        },
        setLoading(isLoading) {
            this.isLoading = isLoading;
        },
        reset() {
            Object.assign(this, defaultState());
        },
    },
});
