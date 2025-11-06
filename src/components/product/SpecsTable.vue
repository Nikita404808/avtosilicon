<template>
  <section class="specs">
    <h2>Характеристики</h2>
    <dl class="specs__list">
      <div v-for="spec in specs" :key="spec.label" class="specs__row">
        <dt>{{ spec.label }}</dt>
        <dd>{{ spec.value ?? '—' }}</dd>
      </div>
    </dl>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Product } from '@/types';

const props = defineProps<{
  product: Product;
}>();

const specs = computed(() => [
  { label: 'Код', value: props.product.code },
  { label: 'Артикул', value: props.product.sku },
  { label: 'Материал', value: props.product.material },
  { label: 'Серия', value: props.product.series },
  { label: 'Тип транспорта', value: props.product.transportType },
  { label: 'Штрих-код', value: props.product.barcode },
  {
    label: 'Вес',
    value: props.product.weightKg ? `${props.product.weightKg.toFixed(2)} кг` : undefined,
  },
]);
</script>

<style scoped lang="scss">
.specs {
  background: var(--surface);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  box-shadow: var(--shadow-sm);

  h2 {
    margin-top: 0;
    margin-bottom: var(--space-4);
  }
}

.specs__list {
  display: grid;
  gap: var(--space-3);
}

.specs__row {
  display: grid;
  grid-template-columns: 200px 1fr;
  gap: var(--space-4);
  padding-bottom: var(--space-3);
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);

  dt {
    color: var(--text-secondary);
  }
}
</style>
