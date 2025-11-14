import { defineStore } from 'pinia';
import type { FilterState, Product } from '@/types';
import { fetchProducts as fetchDirectusProducts } from '@/api/directus';

type CatalogState = {
  products: Product[];
  filters: FilterState;
  total: number;
  pageSize: number;
  isLoading: boolean;
  hasLoaded: boolean;
};

const defaultState = (): CatalogState => ({
  products: [],
  filters: {
    categories: [],
    page: 1,
  },
  total: 0,
  pageSize: 12,
  isLoading: false,
  hasLoaded: false,
});

export const useCatalogStore = defineStore('catalog', {
  state: defaultState,
  getters: {
    totalPages: (state) => Math.max(1, Math.ceil(state.total / state.pageSize)),
    activeCategories: (state) => state.filters.categories ?? [],
  },
  actions: {
    setFilters(payload: Partial<FilterState>) {
      this.filters = {
        ...this.filters,
        ...payload,
        categories: payload.categories ?? this.filters.categories,
      };
    },
    setProducts(products: Product[], total?: number) {
      this.products = products;
      if (typeof total === 'number') {
        this.total = total;
      } else {
        this.total = products.length;
      }
    },
    setLoading(isLoading: boolean) {
      this.isLoading = isLoading;
    },
    setLoaded(isLoaded: boolean) {
      this.hasLoaded = isLoaded;
    },
    reset() {
      Object.assign(this, defaultState());
    },
    async fetchProducts(force = false) {
      if (this.hasLoaded && !force) {
        return;
      }

      this.setLoading(true);
      try {
        const products = await fetchDirectusProducts();
        this.setProducts(products);
      } catch (error) {
        console.error('[CatalogStore] Failed to load products', error);
      } finally {
        this.setLoading(false);
        this.setLoaded(true);
      }
    },
  },
});
