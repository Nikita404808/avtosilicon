<template>
  <div class="app">
    <AppHeader />
    <main>
      <RouterView />
    </main>
    <AppFooter />
    <CartDrawer @checkout="openCheckout" />
    <AuthModal />
    <CheckoutModal :open="isCheckoutOpen" @close="closeCheckout" @submit="handleCheckoutSubmit" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { RouterView } from 'vue-router';
import AppHeader from '@/components/AppHeader.vue';
import AppFooter from '@/components/AppFooter.vue';
import CartDrawer from '@/components/CartDrawer.vue';
import AuthModal from '@/components/AuthModal.vue';
import CheckoutModal from '@/components/CheckoutModal.vue';

const isCheckoutOpen = ref(false);

const openCheckout = () => {
  isCheckoutOpen.value = true;
};

const closeCheckout = () => {
  isCheckoutOpen.value = false;
};

const handleCheckoutSubmit = (payload: { service: string; pointId: string | null }) => {
  console.info('[Checkout]', payload);
  alert('Заказ будет оформлен после интеграции оплаты.');
};
</script>

<style scoped>
.app {
  min-height: 100vh;
  background-color: var(--bg);
  color: var(--text-primary);
  display: flex;
  flex-direction: column;
}

main {
  flex: 1;
}
</style>
