<template>
  <section class="checkout-page page-content">
    <h1>Оформление заказа</h1>
    <p>Мы открыли окно оформления заказа. Если оно закрыто, нажмите кнопку ниже.</p>
    <button type="button" @click="reopenCheckout">Открыть снова</button>
  </section>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useUiStore } from '@/stores/ui';
import { useCartStore } from '@/stores/cart';

const uiStore = useUiStore();
const cartStore = useCartStore();

const reopenCheckout = () => {
  cartStore.toggleCart(true);
  uiStore.openCheckout();
};

onMounted(() => {
  reopenCheckout();
});
</script>

<style scoped lang="scss">
.checkout-page {
  padding: var(--space-8) 0;
  display: grid;
  gap: var(--space-4);
  background: var(--surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  margin-top: var(--space-6);

  button {
    justify-self: flex-start;
    border: none;
    border-radius: var(--radius-md);
    padding: var(--space-3) var(--space-5);
    background: var(--accent);
    color: #fff;
    font-weight: 600;
  }
}
</style>
