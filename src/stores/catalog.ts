import { defineStore } from 'pinia';
import type { FilterState, Product } from '@/types';

type CatalogState = {
  products: Product[];
  filters: FilterState;
  total: number;
  pageSize: number;
  isLoading: boolean;
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
    reset() {
      Object.assign(this, defaultState());
    },
  },
});
