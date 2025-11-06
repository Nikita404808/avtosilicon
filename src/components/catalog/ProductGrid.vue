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
}
</style>
