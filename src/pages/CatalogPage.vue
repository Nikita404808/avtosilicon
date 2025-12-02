<template>
  <div class="catalog page-content">
    <button
      v-if="!isDesktopFilters"
      class="catalog__toggle"
      type="button"
      @click="toggleFilters"
      :aria-expanded="filtersOpen"
    >
      Фильтры
    </button>
    <div class="catalog__layout">
      <transition name="slide">
        <div v-if="filtersOpen" class="catalog__filters-wrapper" ref="filtersRef">
          <CatalogFilters
            :filters="filters"
            :car-model-options="carModelOptions"
            :part-type-options="partTypeOptions"
            :selected-car-model-id="selectedCarModelId"
            :selected-part-type-id="selectedPartTypeId"
            @update:filters="handleFilters"
            @submit:search="handleSearch"
            @reset="resetFilters"
            @update:carModelId="setSelectedCarModelId"
            @update:partTypeId="setSelectedPartTypeId"
          />
        </div>
      </transition>
      <section class="catalog__content">
        <header class="catalog__header page-content">
          <div class="catalog__header-top">
            <h1 class="catalog__title">Каталог</h1>
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
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useRoute, useRouter } from 'vue-router';
import CatalogFilters from '@/components/catalog/CatalogFilters.vue';
import ProductGrid from '@/components/catalog/ProductGrid.vue';
import Pagination from '@/components/catalog/Pagination.vue';
import type { CarModelRef, FilterState, PartTypeRef, Product } from '@/types';
import { fetchCarModels, fetchPartTypes } from '@/api/directus';
import { useCatalogStore } from '@/stores/catalog';

const route = useRoute();
const router = useRouter();

const catalogStore = useCatalogStore();
const DESKTOP_FILTER_BREAKPOINT = 1024;
const { products: catalogProducts, isLoading: catalogIsLoading } = storeToRefs(catalogStore);
const allProducts = computed(() => catalogProducts.value);
const carModels = ref<CarModelRef[]>([]);
const partTypes = ref<PartTypeRef[]>([]);
const selectedCarModelId = ref<number | string | null>(null);
const selectedPartTypeId = ref<number | string | null>(null);
const carModelOptions = computed(() =>
  carModels.value.map((model) => ({
    value: model.id,
    label: model.name,
  })),
);
const partTypeOptions = computed(() =>
  partTypes.value.map((type) => ({
    value: type.id,
    label: type.name,
  })),
);
const products = ref<Product[]>([]);
const total = ref(0);
const filters = ref<FilterState>({
  q: '',
  page: 1,
});
const catalogSearch = ref(filters.value.q ?? '');
const filtersRef = ref<HTMLElement | null>(null);
const pageSize = 12;
const isFiltering = ref(false);
const isLoading = computed(() => catalogIsLoading.value || isFiltering.value);
const filtersOpen = ref(true);
const isDesktopFilters = ref(false);

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)));

type ParsedQueryState = {
  filterState: FilterState;
  carModelId: string | null;
  partTypeId: string | null;
};

const parseQuery = (): ParsedQueryState => {
  const { q, carModel, partType, page } = route.query;
  return {
    filterState: {
      q: typeof q === 'string' ? q : undefined,
      page: typeof page === 'string' ? Number(page) || 1 : 1,
    },
    carModelId: typeof carModel === 'string' && carModel ? carModel : null,
    partTypeId: typeof partType === 'string' && partType ? partType : null,
  };
};

const syncFromRoute = () => {
  const parsed = parseQuery();
  Object.assign(filters.value, parsed.filterState);
  selectedCarModelId.value = parsed.carModelId;
  selectedPartTypeId.value = parsed.partTypeId;
};

const syncToRoute = () => {
  const query: Record<string, string> = {};
  if (filters.value.q) query.q = filters.value.q;
  if (filters.value.page && filters.value.page > 1) {
    query.page = String(filters.value.page);
  }
  if (selectedCarModelId.value) {
    query.carModel = String(selectedCarModelId.value);
  }
  if (selectedPartTypeId.value) {
    query.partType = String(selectedPartTypeId.value);
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

      const matchesCarModel = (() => {
        if (!selectedCarModelId.value) return true;
        const productCarModelId = product.carModel?.id;
        if (productCarModelId === undefined || productCarModelId === null) {
          return false;
        }
        return String(productCarModelId) === String(selectedCarModelId.value);
      })();

      const matchesPartType = (() => {
        if (!selectedPartTypeId.value) return true;
        const productPartTypeId = product.partType?.id;
        if (productPartTypeId === undefined || productPartTypeId === null) {
          return false;
        }
        return String(productPartTypeId) === String(selectedPartTypeId.value);
      })();

      return matchesQuery && matchesCarModel && matchesPartType;
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
  filters.value = { q: '', page: 1 };
  selectedCarModelId.value = null;
  selectedPartTypeId.value = null;
};

const toggleFilters = () => {
  if (isDesktopFilters.value) return;
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
  filtersOpen,
  async (isOpen) => {
    if (!isOpen || isDesktopFilters.value) return;
    await nextTick();
    filtersRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },
);

watch(
  catalogProducts,
  () => {
    applyFilters();
  },
  { immediate: true },
);

watch([selectedCarModelId, selectedPartTypeId], () => {
  filters.value.page = 1;
  syncToRoute();
  applyFilters();
});

const setSelectedCarModelId = (value: number | string | null) => {
  selectedCarModelId.value = value;
};

const setSelectedPartTypeId = (value: number | string | null) => {
  selectedPartTypeId.value = value;
};

const loadFilterOptions = async () => {
  try {
    carModels.value = await fetchCarModels();
  } catch (error) {
    console.error('[Catalog] Failed to load car models', error);
  }
  try {
    partTypes.value = await fetchPartTypes();
  } catch (error) {
    console.error('[Catalog] Failed to load part types', error);
  }
};

const handleViewport = () => {
  const width = window.innerWidth;
  isDesktopFilters.value = width >= DESKTOP_FILTER_BREAKPOINT;
  if (isDesktopFilters.value) {
    filtersOpen.value = true;
  }
};

onMounted(() => {
  handleViewport();
  window.addEventListener('resize', handleViewport);
  catalogStore.fetchProducts();
  loadFilterOptions();
});

onUnmounted(() => {
  window.removeEventListener('resize', handleViewport);
});
</script>

<style scoped lang="scss">
.catalog {
  padding: var(--space-6) 0 var(--space-8);
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  overflow-x: hidden;
}

.catalog__toggle {
  display: none;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface);
  padding: var(--space-2) var(--space-4);
  font-weight: 600;
  align-items: center;
  gap: var(--space-2);

  @media (max-width: 1023px) {
    display: inline-flex;
    align-self: flex-end;
  }

  @media (max-width: 640px) {
    width: 100%;
    justify-content: center;
  }
}

.catalog__layout {
  display: grid;
  grid-template-columns: minmax(260px, 320px) minmax(0, 1fr);
  gap: var(--space-6);
  align-items: start;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;

  @media (max-width: $breakpoint-laptop) {
    grid-template-columns: 1fr;
    gap: var(--space-4);
  }
}

.catalog__content {
  display: grid;
  gap: var(--space-5);
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  min-width: 0;
}

.catalog__filters-wrapper {
  align-self: stretch;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  scroll-margin-top: 96px;
  position: relative;
  z-index: 10;
  isolation: isolate;

  @media (max-width: 1024px) {
    max-height: none;
    overflow: visible;
    border-radius: var(--radius-lg);
    background: var(--bg);
    padding: var(--space-1);
    margin-top: var(--space-2);
  }
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

.catalog__title {
  margin: 0;
  position: relative;
  left: clamp(-24px, -3vw, -12px);
}

@media (max-width: $breakpoint-tablet) {
  .catalog__title {
    left: var(--space-1);
  }
}

.catalog__header p {
  margin: 0;
  color: var(--text-secondary);
}

.catalog__search {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: var(--space-1);
  background: var(--surface);
  border-radius: var(--radius-md);
  padding: var(--space-1);
  width: 100%;
  max-width: 480px;
  box-sizing: border-box;
}

.catalog__search input {
  flex: 1;
  min-width: 0;
  max-width: 100%;
  border: none;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-primary);
  min-height: 48px;
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
  min-height: 48px;
  flex-shrink: 0;
}

.catalog__search button:hover,
.catalog__search button:focus-visible {
  filter: brightness(1.05);
}

@media (max-width: 1024px) {
  .catalog {
    padding-top: var(--space-5);
  }
}

@media (max-width: $breakpoint-mobile) {
  .catalog {
    padding-top: var(--space-4);
  }

  .catalog__search {
    gap: 8px;
    flex-wrap: nowrap;
  }

  .catalog__search button {
    width: auto;
    min-height: 36px;
    padding: 6px 12px;
    font-size: 14px;
    max-width: 30%;
  }
}

@media (max-width: 560px) {
  .catalog__header-top {
    gap: var(--space-2);
    flex-direction: column;
    align-items: stretch;
  }

  .catalog__search {
    width: 100%;
  }

  .catalog {
    gap: var(--space-4);
  }

  .catalog__toggle {
    width: 100%;
    justify-content: center;
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
