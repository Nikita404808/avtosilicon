<template>
  <section class="grid">
    <div v-if="isLoading" class="grid__loading" role="status">
      Загрузка каталога...
    </div>
    <div v-else-if="!products.length" class="grid__empty">По вашему запросу ничего не найдено</div>
    <div v-else class="grid__list">
      <ProductCard v-for="product in products" :key="product.id" :product="product" />
    </div>
  </section>
</template>

<script setup lang="ts">
import type { Product } from '@/types';
import ProductCard from './ProductCard.vue';

defineProps<{
  products: Product[];
  isLoading?: boolean;
}>();
</script>

<style scoped lang="scss">
.grid__loading,
.grid__empty {
  padding: var(--space-6);
  text-align: center;
  background: rgba(0, 0, 0, 0.04);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
}

.grid__list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: var(--space-5);

  @media (max-width: 1024px) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-4);
  }

  @media (max-width: 900px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (max-width: $breakpoint-tablet) {
    gap: var(--space-3);
  }

  @media (max-width: $breakpoint-mobile) {
    grid-template-columns: 1fr;
  }
}
</style>
