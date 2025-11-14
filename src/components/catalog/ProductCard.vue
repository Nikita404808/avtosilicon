<template>
  <article class="card">
    <RouterLink :to="`/catalog/${product.slug}`" class="card__image">
      <img :src="product.images[0] ?? placeholderImage" :alt="product.title" loading="lazy" />
    </RouterLink>
    <div class="card__body">
      <RouterLink :to="`/catalog/${product.slug}`" class="card__title">
        {{ product.title }}
      </RouterLink>
      <p class="card__price">{{ formattedPrice }}</p>
    </div>
    <button type="button" class="card__button" @click="addToCart">В корзину</button>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { useCartStore } from '@/stores/cart';
import type { Product } from '@/types';

const props = defineProps<{
  product: Product;
}>();

const placeholderImage = '/placeholder/product.svg';
const cartStore = useCartStore();
const currencyFormatter = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0,
});

const formattedPrice = computed(() => {
  if (typeof props.product.price === 'number') {
    return currencyFormatter.format(props.product.price);
  }
  return 'Цена по запросу';
});

const addToCart = () => {
  cartStore.addItem({
    productId: String(props.product.id),
    quantity: 1,
    price: {
      amount: props.product.price ?? 0,
      currency: 'RUB',
    },
  });
  cartStore.toggleCart(true);
};
</script>

<style scoped lang="scss">
.card {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  background: var(--surface);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  padding: var(--space-4);
}

.card__image {
  aspect-ratio: 1 / 1;
  border-radius: var(--radius-md);
  background: #f3f6ff;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
}

.card__title {
  display: block;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.4;
  min-height: 3em;
}

.card__price {
  font-size: 20px;
  font-weight: 700;
}

.card__button {
  margin-top: auto;
  border: none;
  border-radius: var(--radius-md);
  padding: var(--space-3);
  background: var(--accent);
  color: #fff;
  font-weight: 600;
  transition: filter 120ms ease;

  &:hover,
  &:focus-visible {
    filter: brightness(1.05);
  }
}
</style>
