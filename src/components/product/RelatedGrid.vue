<template>
  <section class="related" v-if="products.length">
    <header class="related__header">
      <h2>{{ title }}</h2>
      <RouterLink :to="link.href" class="related__link">{{ link.label }}</RouterLink>
    </header>
    <div class="related__grid">
      <ProductCard v-for="product in products" :key="product.id" :product="product" />
    </div>
  </section>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router';
import type { Product } from '@/types';
import ProductCard from '@/components/catalog/ProductCard.vue';

defineProps<{
  title: string;
  link: { href: string; label: string };
  products: Product[];
}>();
</script>

<style scoped lang="scss">
.related {
  display: grid;
  gap: var(--space-4);
}

.related__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.related__link {
  color: var(--accent);
  font-weight: 600;
}

.related__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: var(--space-4);
}

@media (max-width: $breakpoint-tablet) {
  .related__header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-2);
  }
}
</style>
