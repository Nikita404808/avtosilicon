<template>
  <div class="product container" v-if="product">
    <nav class="product__breadcrumbs" aria-label="Хлебные крошки">
      <RouterLink to="/">Главная</RouterLink>
      <span aria-hidden="true">/</span>
      <RouterLink to="/catalog">Каталог</RouterLink>
      <span aria-hidden="true">/</span>
      <span>{{ product.title }}</span>
    </nav>

    <div class="product__layout">
      <Gallery :images="product.images" :title="product.title" />
      <BuyBox :product="product" />
    </div>

    <section class="product__details">
      <article class="product__description" v-html="product.descriptionHtml"></article>
      <SpecsTable :product="product" />
      <CompatibilityList :compatibility="product.compatibility" />
      <MayFitBlock :items="mayFit" />
    </section>

    <RelatedGrid
      title="Похожие товары"
      :link="{ href: '/catalog', label: 'В каталог' }"
      :products="related"
    />
  </div>
  <div v-else class="product__notfound container">
    <h1>Товар не найден</h1>
    <RouterLink to="/catalog">Вернуться в каталог</RouterLink>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, RouterLink } from 'vue-router';
import productsMock from '@/mocks/products.json';
import type { Product } from '@/types';
import Gallery from '@/components/product/Gallery.vue';
import BuyBox from '@/components/product/BuyBox.vue';
import SpecsTable from '@/components/product/SpecsTable.vue';
import CompatibilityList from '@/components/product/CompatibilityList.vue';
import RelatedGrid from '@/components/product/RelatedGrid.vue';
import MayFitBlock from '@/components/product/MayFitBlock.vue';

const route = useRoute();
const allProducts = productsMock as Product[];

const product = computed(() =>
  allProducts.find((item) => item.slug === (route.params.slug as string)),
);

const related = computed(() => {
  if (!product.value) return [];
  return allProducts
    .filter(
      (item) =>
        item.id !== product.value?.id &&
        item.categories.some((category) => product.value?.categories.includes(category)),
    )
    .slice(0, 4);
});

const mayFit = computed(() => product.value?.compatibility.slice(0, 6) ?? []);
</script>

<style scoped lang="scss">
.product {
  padding: var(--space-6) 0 var(--space-8);
  display: grid;
  gap: var(--space-6);
}

.product__breadcrumbs {
  display: inline-flex;
  gap: var(--space-2);
  font-size: var(--fz-caption);
  color: var(--text-secondary);
}

.product__layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 420px);
  gap: var(--space-6);

  @media (max-width: $breakpoint-laptop) {
    grid-template-columns: 1fr;
  }
}

.product__details {
  display: grid;
  gap: var(--space-5);
}

.product__description {
  background: var(--surface);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  box-shadow: var(--shadow-sm);
  color: var(--text-secondary);
}

.product__notfound {
  padding: var(--space-8) 0;
  display: grid;
  gap: var(--space-4);
}
</style>
