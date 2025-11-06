<template>
  <aside class="filters">
    <form class="filters__search" @submit.prevent="submitKeyword">
      <label for="catalog-search">Поиск по каталогу</label>
      <div class="filters__search-field">
        <input
          id="catalog-search"
          v-model="keyword"
          type="search"
          placeholder="Введите артикул или название"
        />
        <button type="submit">Найти</button>
      </div>
    </form>

    <MakeModelTree
      :makes="makeModelData"
      :selected-make="internalFilters.make"
      :selected-model="internalFilters.model"
      @update:make="updateFilters({ make: $event })"
      @update:model="updateFilters({ model: $event })"
    />

    <CategoryList
      :categories="categories"
      :selected="internalFilters.categories ?? []"
      @update:selected="updateFilters({ categories: $event })"
    />

    <button type="button" class="filters__reset" @click="resetFilters">Сбросить фильтры</button>
  </aside>
</template>

<script setup lang="ts">
import { reactive, ref, watch } from 'vue';
import type { FilterState } from '@/types';
import MakeModelTree, { type MakeItem } from './MakeModelTree.vue';
import CategoryList, { type CategoryItem } from './CategoryList.vue';

const props = defineProps<{
  filters: FilterState;
  makeModelData: MakeItem[];
  categories: CategoryItem[];
}>();

const emit = defineEmits<{
  (event: 'update:filters', value: Partial<FilterState>): void;
  (event: 'submit:search', value: string): void;
  (event: 'reset'): void;
}>();

const internalFilters = reactive<FilterState>({ ...props.filters });
const keyword = ref(props.filters.q ?? '');
const selectedCategories = ref<string[]>(props.filters.categories ?? []);

watch(
  () => props.filters,
  (next) => {
    Object.assign(internalFilters, next);
    keyword.value = next.q ?? '';
    selectedCategories.value = next.categories ?? [];
  },
  { deep: true },
);

const updateFilters = (partial: Partial<FilterState>) => {
  Object.assign(internalFilters, partial);
  emit('update:filters', partial);
};

const submitKeyword = () => {
  emit('update:filters', { q: keyword.value, page: 1 });
  emit('submit:search', keyword.value);
};

const resetFilters = () => {
  Object.assign(internalFilters, { q: '', make: undefined, model: undefined, categories: [] });
  keyword.value = '';
  selectedCategories.value = [];
  emit('reset');
};

const onCategoryChange = () => {
  const values = selectedCategories.value.filter(Boolean);
  updateFilters({ categories: values });
};
</script>

<style scoped lang="scss">
.filters {
  display: grid;
  gap: var(--space-5);
  padding: var(--space-5) var(--space-4);
  background: var(--surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  max-width: 320px;
  width: 100%;
}

.filters__search {
  display: grid;
  gap: var(--space-2);

  label {
    font-weight: 600;
  }
}

.filters__search-field {
  display: flex;
  gap: var(--space-2);

  input {
    flex: 1;
    border-radius: var(--radius-md);
    border: 1px solid var(--border);
    padding: var(--space-2) var(--space-3);
  }

  button {
    border-radius: var(--radius-md);
    border: none;
    background: var(--accent);
    color: #fff;
    padding: var(--space-2) var(--space-4);
    font-weight: 600;
  }
}

.filters__reset {
  border: none;
  background: transparent;
  color: var(--text-secondary);
  text-decoration: underline;
  justify-self: flex-start;
}

@media (max-width: $breakpoint-laptop) {
  .filters {
    max-width: 100%;
  }
}
</style>
