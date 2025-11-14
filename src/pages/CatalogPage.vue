<template>
  <div class="catalog container">
    <button
      class="catalog__toggle"
      type="button"
      @click="toggleFilters"
      :aria-expanded="filtersOpen"
    >
      Фильтры
    </button>
    <div class="catalog__layout">
      <transition name="slide">
        <div v-if="filtersOpen" class="catalog__filters-wrapper">
          <CatalogFilters
            :filters="filters"
            :make-model-data="makeModelData"
            :categories="categoryOptions"
            @update:filters="handleFilters"
            @submit:search="handleSearch"
            @reset="resetFilters"
          />
        </div>
      </transition>
      <section class="catalog__content">
        <header class="catalog__header">
          <div class="catalog__header-top">
            <h1>Каталог</h1>
            <form class="catalog__search" role="search" @submit.prevent="submitCatalogSearch">
              <input
                id="catalog-page-search"
                v-model="catalogSearch"
                type="search"
                placeholder="Я хочу купить..."
                autocomplete="off"
                aria-label="Поиск по каталогу"
              />
              <button type="submit">Найти</button>
            </form>
          </div>
          <p>Найдено {{ total }} товаров</p>
        </header>
        <ProductGrid :products="products" :is-loading="isLoading" />
        <div class="catalog__pagination">
          <Pagination :current-page="filters.page ?? 1" :total-pages="totalPages" @update:page="handlePage" />
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useRoute, useRouter } from 'vue-router';
import CatalogFilters from '@/components/catalog/CatalogFilters.vue';
import ProductGrid from '@/components/catalog/ProductGrid.vue';
import Pagination from '@/components/catalog/Pagination.vue';
import type { FilterState, Product } from '@/types';
import type { MakeItem } from '@/components/catalog/MakeModelTree.vue';
import type { CategoryItem } from '@/components/catalog/CategoryList.vue';
import categoriesMock from '@/mocks/categories.json';
import makeModelMock from '@/mocks/makes-models.json';
import { useCatalogStore } from '@/stores/catalog';

const route = useRoute();
const router = useRouter();

const catalogStore = useCatalogStore();
const { products: catalogProducts, isLoading: catalogIsLoading } = storeToRefs(catalogStore);
const allProducts = computed(() => catalogProducts.value);
const categoryOptions = ref(categoriesMock as CategoryItem[]);
const makeModelData = ref(makeModelMock as MakeItem[]);
const products = ref<Product[]>([]);
const total = ref(0);
const filters = ref<FilterState>({
  q: '',
  make: undefined,
  model: undefined,
  categories: [],
  page: 1,
});
const catalogSearch = ref(filters.value.q ?? '');
const pageSize = 12;
const isFiltering = ref(false);
const isLoading = computed(() => catalogIsLoading.value || isFiltering.value);
const filtersOpen = ref(true);

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)));

const makeKeywordMap = computed(() => {
  const map = new Map<string, string[]>();
  makeModelData.value.forEach((make) => {
    const tokens = new Set<string>();
    tokens.add(make.value.toLowerCase());
    tokens.add(make.label.toLowerCase());
    make.keywords?.forEach((keyword) => tokens.add(keyword.toLowerCase()));
    map.set(make.value, Array.from(tokens));
  });
  return map;
});

const parseQuery = (): FilterState => {
  const { q, make, model, cat, page } = route.query;
  return {
    q: typeof q === 'string' ? q : undefined,
    make: typeof make === 'string' ? make : undefined,
    model: typeof model === 'string' ? model : undefined,
    categories: typeof cat === 'string' ? cat.split(',').filter(Boolean) : [],
    page: typeof page === 'string' ? Number(page) || 1 : 1,
  };
};

const syncFromRoute = () => {
  Object.assign(filters.value, parseQuery());
};

const syncToRoute = () => {
  const query: Record<string, string> = {};
  if (filters.value.q) query.q = filters.value.q;
  if (filters.value.make) query.make = filters.value.make;
  if (filters.value.model) query.model = filters.value.model;
  if (filters.value.categories && filters.value.categories.length) {
    query.cat = filters.value.categories.join(',');
  }
  if (filters.value.page && filters.value.page > 1) {
    query.page = String(filters.value.page);
  }

  router.replace({ name: 'catalog', query }).catch(() => {
    /* ignore redundant */
  });
};

const applyFilters = () => {
  isFiltering.value = true;
  window.requestAnimationFrame(() => {
    const startIndex = ((filters.value.page ?? 1) - 1) * pageSize;
    const filtered = allProducts.value.filter((product) => {
      const matchesQuery = (() => {
        if (!filters.value.q) return true;
        const query = filters.value.q.toLowerCase();
        const tokens = [product.name, product.sku].map((value) => value?.toLowerCase() ?? '');
        return tokens.some((token) => token.includes(query));
      })();
      const matchesMake = (() => {
        if (!filters.value.make) return true;
        const tokens = makeKeywordMap.value.get(filters.value.make) ?? [];
        if (!tokens.length) return true;
        const candidates = [product.carBrand, product.brand]
          .map((value) => value?.toLowerCase())
          .filter(Boolean) as string[];
        if (!candidates.length) return false;
        return tokens.some((token) => candidates.some((entry) => entry.includes(token)));
      })();
      const matchesModel = filters.value.model
        ? (product.carModel ?? '').toLowerCase().includes(filters.value.model!.toLowerCase())
        : true;
      const matchesCategory =
        filters.value.categories && filters.value.categories.length
          ? filters.value.categories.every((category) => product.categories.includes(category))
          : true;
      return matchesQuery && matchesMake && matchesModel && matchesCategory;
    });

    total.value = filtered.length;
    products.value = filtered.slice(startIndex, startIndex + pageSize);
    isFiltering.value = false;
  });
};

const handleFilters = (partial: Partial<FilterState>) => {
  filters.value = { ...filters.value, ...partial, page: partial.page ?? 1 };
};

const handleSearch = () => {
  filters.value.page = 1;
};

const handlePage = (page: number) => {
  filters.value.page = page;
};

const resetFilters = () => {
  filters.value = { q: '', make: undefined, model: undefined, categories: [], page: 1 };
};

const toggleFilters = () => {
  filtersOpen.value = !filtersOpen.value;
};

const submitCatalogSearch = () => {
  const query = catalogSearch.value.trim();
  handleFilters({ q: query, page: 1 });
  handleSearch();
};

watch(
  () => route.query,
  () => {
    syncFromRoute();
    applyFilters();
  },
  { immediate: true },
);

watch(
  filters,
  () => {
    syncToRoute();
    applyFilters();
    catalogSearch.value = filters.value.q ?? '';
  },
  { deep: true },
);

watch(
  catalogProducts,
  () => {
    applyFilters();
  },
  { immediate: true },
);

onMounted(() => {
  filtersOpen.value = window.innerWidth >= 992;
  catalogStore.fetchProducts();
});
</script>

<style scoped lang="scss">
.catalog {
  padding: var(--space-6) 0 var(--space-8);
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.catalog__toggle {
  display: none;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface);
  padding: var(--space-2) var(--space-4);

  @media (max-width: $breakpoint-laptop) {
    display: inline-flex;
    align-self: flex-end;
  }
}

.catalog__layout {
  display: grid;
  grid-template-columns: minmax(260px, 320px) minmax(0, 1fr);
  gap: var(--space-6);
  align-items: start;

  @media (max-width: $breakpoint-laptop) {
    grid-template-columns: 1fr;
  }
}

.catalog__content {
  display: grid;
  gap: var(--space-5);
}

.catalog__filters-wrapper {
  align-self: stretch;
}

.catalog__header {
  display: grid;
  gap: var(--space-3);
}

.catalog__header-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.catalog__header-top h1 {
  margin: 0;
}

.catalog__header p {
  margin: 0;
  color: var(--text-secondary);
}

.catalog__search {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  background: var(--surface);
  border-radius: var(--radius-md);
  padding: var(--space-1);
  width: clamp(220px, 28vw, 360px);
}

.catalog__search input {
  flex: 1;
  border: none;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-primary);
}

.catalog__search input:focus-visible {
  outline: 2px solid rgba(0, 87, 184, 0.35);
}

.catalog__search button {
  border: none;
  border-radius: var(--radius-sm);
  background: var(--brand-primary);
  color: #fff;
  padding: var(--space-2) var(--space-4);
  font-weight: 600;
  transition: filter 120ms ease-out;
}

.catalog__search button:hover,
.catalog__search button:focus-visible {
  filter: brightness(1.05);
}

@media (max-width: $breakpoint-tablet) {
  .catalog__header-top {
    flex-direction: column;
    align-items: stretch;
  }

  .catalog__search {
    width: 100%;
  }
}

.catalog__pagination {
  display: flex;
  justify-content: center;
}

.slide-enter-active,
.slide-leave-active {
  transition: all 160ms ease;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  transform: translateY(-12px);
}
</style>
