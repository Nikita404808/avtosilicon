<template>
  <section v-if="specs.length" class="specs">
    <h2>Характеристики</h2>
    <dl class="specs__list">
      <div v-for="spec in specs" :key="spec.label" class="specs__row">
        <dt>{{ spec.label }}</dt>
        <dd>{{ spec.value }}</dd>
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

type SpecCandidate = {
  label: string;
  value: string | null;
};

const formatValue = (
  value: string | number | null | undefined,
  options?: { suffix?: string },
): string | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return null;
    }
    return options?.suffix ? `${value} ${options.suffix}` : value.toString();
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || null;
  }
  return null;
};

const specs = computed(() => {
  const items: SpecCandidate[] = [
    { label: 'Код', value: formatValue(props.product.code) },
    { label: 'Артикул', value: formatValue(props.product.sku) },
    { label: 'Материал', value: formatValue(props.product.material) },
    { label: 'Цвет', value: formatValue(props.product.color) },
    { label: 'Тип транспорта', value: formatValue(props.product.transportType) },
    { label: 'Штрих-код', value: formatValue(props.product.barcode) },
    {
      label: 'Вес',
      value: formatValue(props.product.weight, {
        suffix: typeof props.product.weight === 'number' ? 'кг' : undefined,
      }),
    },
    { label: 'Внутренний диаметр', value: formatValue(props.product.innerDiameter) },
    { label: 'Модель транспорта', value: formatValue(props.product.carModel?.name) },
    { label: 'Тип запчасти', value: formatValue(props.product.partType?.name) },
  ];

  return items.filter((item): item is { label: string; value: string } => Boolean(item.value));
});
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

@media (max-width: 1024px) {
  .specs {
    padding: var(--space-5);
  }

  .specs__row {
    grid-template-columns: 1fr;
    gap: var(--space-2);
  }
}

@media (max-width: $breakpoint-mobile) {
  .specs {
    padding: var(--space-4);
    border-radius: var(--radius-lg);
  }
}
</style>
