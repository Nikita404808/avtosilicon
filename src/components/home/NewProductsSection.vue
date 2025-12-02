<template>
  <section class="new-products">
    <div class="container">
      <header class="new-products__header">
        <div>
          <p class="new-products__eyebrow">Подборка Directus</p>
          <h2>Новинки</h2>
        </div>
        <RouterLink to="/catalog" class="new-products__link">В каталог</RouterLink>
      </header>

      <div v-if="isLoading" class="new-products__state">Загрузка новинок...</div>
      <div v-else-if="hasError" class="new-products__state new-products__state--error">
        {{ error }}
      </div>
      <div v-else-if="hasItems" class="new-products__grid">
        <ProductCard v-for="product in newProducts" :key="product.id" :product="product" />
      </div>
      <div v-else class="new-products__state">Новинок пока нет.</div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import ProductCard from '@/components/catalog/ProductCard.vue';
import { fetchNewProducts } from '@/api/directus';
import type { Product } from '@/types';

const newProducts = ref<Product[]>([]);
const isLoading = ref(true);
const error = ref<string | null>(null);

const loadNewProducts = async () => {
  isLoading.value = true;
  error.value = null;
  try {
    newProducts.value = await fetchNewProducts(5);
  } catch (err) {
    console.error('[Home][NewProducts]', err);
    error.value = err instanceof Error ? err.message : 'Не удалось загрузить новинки';
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  loadNewProducts();
});

const hasItems = computed(() => newProducts.value.length > 0);
const hasError = computed(() => Boolean(error.value));
</script>

<style scoped lang="scss">
.new-products {
  padding: var(--space-8) 0;
  background: #f7f9ff;
}

.new-products__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-4);
  margin-bottom: var(--space-5);

  h2 {
    margin: 0;
  }
}

.new-products__eyebrow {
  text-transform: uppercase;
  font-size: var(--fz-caption);
  letter-spacing: 0.08em;
  color: var(--accent);
  margin-bottom: var(--space-1);
}

.new-products__link {
  align-self: center;
  border-radius: var(--radius-lg);
  padding: var(--space-2) var(--space-4);
  border: 1px solid var(--accent);
  color: var(--accent);
  font-weight: 600;
}

.new-products__state {
  padding: var(--space-6);
  text-align: center;
  border-radius: var(--radius-md);
  background: rgba(0, 0, 0, 0.04);
  color: var(--text-secondary);
}

.new-products__state--error {
  color: var(--danger, #c62828);
}

.new-products__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: var(--space-4);
}

@media (max-width: $breakpoint-mobile) {
  .new-products__header {
    flex-direction: column;
    align-items: flex-start;
  }

  .new-products__link {
    align-self: flex-start;
  }
}
</style>
