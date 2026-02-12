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

const normalizeWeightKgFromProduct = (rawWeight: unknown) => {
  // Directus: grams → Cart: kilograms (float)
  const grams = typeof rawWeight === 'string' ? Number.parseFloat(rawWeight) : Number(rawWeight);
  if (!Number.isFinite(grams) || grams <= 0) return 0;
  return grams / 1000;
};

const increment = () => {
  quantity.value += 1;
};

const decrement = () => {
  quantity.value = Math.max(1, quantity.value - 1);
};

const addToCart = () => {
  cartStore.addItem({
    productId: String(props.product.id),
    title: props.product.title,
    quantity: quantity.value,
    price: {
      amount: props.product.price ?? 0,
      currency: 'RUB',
    },
    weight: normalizeWeightKgFromProduct(props.product.weight),
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
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);

  h2 {
    margin: 0;
    font-size: var(--fz-h2);
    line-height: var(--lh-h2);
    flex: 1;
  }
}

.buybox__price {
  font-size: 32px;
  font-weight: 700;
  text-align: right;
  white-space: nowrap;
}

.buybox__controls {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  flex-wrap: wrap;
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
  background: rgba(0, 0, 0, 0.02);

  button {
    width: 44px;
    height: 44px;
    border: none;
    background: transparent;
    font-size: 20px;
    font-weight: 700;
    color: var(--text-primary);
    transition: background-color 120ms ease, color 120ms ease;

    &:hover {
      background: rgba(0, 0, 0, 0.06);
    }

    &:focus-visible {
      outline: none;
      box-shadow: inset 0 0 0 2px rgba(255, 102, 0, 0.2);
    }
  }

  input {
    width: 72px;
    text-align: center;
    border: none;
    font-size: 18px;
    font-weight: 600;
    background: transparent;
    padding: 0 var(--space-2);
  }
}

.buybox__stepper button + input,
.buybox__stepper input + button {
  border-left: 1px solid var(--border);
}

.buybox__stepper input[type='number']::-webkit-inner-spin-button,
.buybox__stepper input[type='number']::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.buybox__stepper input[type='number'] {
  -moz-appearance: textfield;
}

.buybox__cta {
  border-radius: var(--radius-md);
  border: none;
  padding: var(--space-3) var(--space-5);
  background: var(--accent);
  color: #fff;
  font-weight: 600;
  font-size: 18px;
  min-height: 52px;
  width: 100%;
}

@media (max-width: 1024px) {
  .buybox {
    padding: var(--space-5);
  }

  .buybox__controls {
    flex-direction: column;
    align-items: stretch;
  }

  .buybox__stepper {
    width: 100%;
    justify-content: space-between;

    input {
      width: 80px;
    }
  }
}

@media (max-width: $breakpoint-mobile) {
  .buybox {
    border-radius: var(--radius-lg);
    padding: var(--space-4);
  }

  .buybox__header {
    flex-direction: column;
    gap: var(--space-3);
  }

  .buybox__price {
    align-self: flex-end;
  }
}
</style>
