<template>
  <section class="buybox" aria-labelledby="buybox-title">
    <header class="buybox__header">
      <h2 id="buybox-title">{{ product.title }}</h2>
      <span class="buybox__price">{{ formattedPrice }}</span>
    </header>
    <div class="buybox__controls">
      <label class="buybox__label" for="quantity">Количество</label>
      <div class="buybox__stepper">
        <button type="button" @click="decrement">−</button>
        <input
          id="quantity"
          v-model.number="quantity"
          type="number"
          min="1"
          aria-label="Количество товара"
        />
        <button type="button" @click="increment">+</button>
      </div>
    </div>
    <button type="button" class="buybox__cta" @click="addToCart">В корзину</button>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useCartStore } from '@/stores/cart';
import type { Product } from '@/types';

const props = defineProps<{
  product: Product;
}>();

const quantity = ref(1);
const cartStore = useCartStore();
const currencyFormatter = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0,
});

watch(
  () => props.product.id,
  () => {
    quantity.value = 1;
  },
);

const formattedPrice = computed(() => {
  if (typeof props.product.price === 'number') {
    return currencyFormatter.format(props.product.price);
  }
  return 'Цена по запросу';
});

const increment = () => {
  quantity.value += 1;
};

const decrement = () => {
  quantity.value = Math.max(1, quantity.value - 1);
};

const addToCart = () => {
  cartStore.addItem({
    productId: String(props.product.id),
    quantity: quantity.value,
    price: {
      amount: props.product.price ?? 0,
      currency: 'RUB',
    },
  });
  cartStore.toggleCart(true);
};
</script>

<style scoped lang="scss">
.buybox {
  background: var(--surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  padding: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.buybox__header {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);

  h2 {
    margin: 0;
    font-size: var(--fz-h2);
    line-height: var(--lh-h2);
  }
}

.buybox__price {
  font-size: 32px;
  font-weight: 700;
}

.buybox__controls {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.buybox__label {
  font-weight: 600;
}

.buybox__stepper {
  display: inline-flex;
  align-items: center;
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  overflow: hidden;

  button {
    width: 44px;
    height: 44px;
    border: none;
    background: rgba(0, 0, 0, 0.04);
    font-size: 20px;
  }

  input {
    width: 64px;
    text-align: center;
    border: none;
    font-size: 18px;
  }
}

.buybox__cta {
  border-radius: var(--radius-md);
  border: none;
  padding: var(--space-3) var(--space-5);
  background: var(--accent);
  color: #fff;
  font-weight: 600;
  font-size: 18px;
}
</style>
