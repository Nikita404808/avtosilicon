<template>
  <aside class="filters">
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
import { computed } from 'vue';
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
  (event: 'reset'): void;
  (event: 'update:carModelId', value: number | string | null): void;
  (event: 'update:partTypeId', value: number | string | null): void;
}>();

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

const resetFilters = () => {
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
}
</style>
