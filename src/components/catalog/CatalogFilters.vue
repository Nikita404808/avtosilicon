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

    <div class="filters__field">
      <label for="catalog-car-model">Марка</label>
      <select id="catalog-car-model" v-model="carModelIdModel" class="filters__select">
        <option value="">Все марки</option>
        <option v-for="option in carModelOptions" :key="option.value" :value="String(option.value)">
          {{ option.label }}
        </option>
      </select>
    </div>

    <div class="filters__field">
      <label for="catalog-part-type">Категория</label>
      <select id="catalog-part-type" v-model="partTypeIdModel" class="filters__select">
        <option value="">Все категории</option>
        <option v-for="option in partTypeOptions" :key="option.value" :value="String(option.value)">
          {{ option.label }}
        </option>
      </select>
    </div>

    <button type="button" class="filters__reset" @click="resetFilters">Сбросить фильтры</button>
  </aside>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import type { FilterState } from '@/types';

type SelectOption = {
  value: number | string;
  label: string;
};

const props = defineProps<{
  filters: FilterState;
  carModelOptions: SelectOption[];
  partTypeOptions: SelectOption[];
  selectedCarModelId: number | string | null;
  selectedPartTypeId: number | string | null;
}>();

const emit = defineEmits<{
  (event: 'update:filters', value: Partial<FilterState>): void;
  (event: 'submit:search', value: string): void;
  (event: 'reset'): void;
  (event: 'update:carModelId', value: number | string | null): void;
  (event: 'update:partTypeId', value: number | string | null): void;
}>();

const internalFilters = reactive<FilterState>({ ...props.filters });
const keyword = ref(props.filters.q ?? '');

watch(
  () => props.filters,
  (next) => {
    Object.assign(internalFilters, next);
    keyword.value = next.q ?? '';
  },
  { deep: true },
);

const carModelIdModel = computed({
  get: () => (props.selectedCarModelId != null ? String(props.selectedCarModelId) : ''),
  set: (value: string) => {
    if (!value) {
      emit('update:carModelId', null);
      return;
    }
    const resolved =
      props.carModelOptions.find((option) => String(option.value) === value)?.value ?? value;
    emit('update:carModelId', resolved);
  },
});

const partTypeIdModel = computed({
  get: () => (props.selectedPartTypeId != null ? String(props.selectedPartTypeId) : ''),
  set: (value: string) => {
    if (!value) {
      emit('update:partTypeId', null);
      return;
    }
    const resolved =
      props.partTypeOptions.find((option) => String(option.value) === value)?.value ?? value;
    emit('update:partTypeId', resolved);
  },
});

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
  emit('update:carModelId', null);
  emit('update:partTypeId', null);
  emit('reset');
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
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  position: relative;
  z-index: 5;
  isolation: isolate;
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
  flex-wrap: wrap;
  gap: var(--space-2);
  width: 100%;
  box-sizing: border-box;

  input {
    flex: 1;
    min-width: 0;
    border-radius: var(--radius-md);
    border: 1px solid var(--border);
    padding: var(--space-2) var(--space-3);
    min-height: 48px;
  }

  button {
    border-radius: var(--radius-md);
    border: none;
    background: var(--accent);
    color: #fff;
    padding: var(--space-2) var(--space-4);
    font-weight: 600;
    min-height: 48px;
    flex-shrink: 0;
  }
}

.filters__field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  position: relative;

  label {
    font-weight: 600;
  }
}

.filters__select {
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  padding: var(--space-2) var(--space-3);
  min-height: 48px;
  background: #fff;
  width: 100%;
  max-width: 100%;
  appearance: none;
  background-image: linear-gradient(45deg, transparent 50%, var(--text-secondary) 50%),
    linear-gradient(135deg, var(--text-secondary) 50%, transparent 50%);
  background-position: right 14px center, right 8px center;
  background-size: 8px 8px, 8px 8px;
  background-repeat: no-repeat;
  padding-right: 48px;
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

@media (min-width: $breakpoint-desktop) {
  .filters {
    max-width: 320px;
  }
}

@media (max-width: 640px) {
  .filters {
    padding: var(--space-4) var(--space-3);
    border-radius: var(--radius-md);
  }

  .filters__search-field {
    flex-wrap: wrap;

    button {
      width: 100%;
    }
  }
}

@media (max-width: $breakpoint-mobile) {
  .filters__search-field button {
    width: 100%;
  }
}
</style>
