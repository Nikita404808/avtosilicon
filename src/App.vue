<template>
  <div class="app">
    <AppHeader />
    <main>
      <RouterView />
    </main>
    <AppFooter />
    <CartDrawer @checkout="openCheckout" />
    <AuthModal />
    <CheckoutModal :open="uiStore.isCheckoutOpen" @close="closeCheckout" @submit="handleCheckoutSubmit" />
  </div>
</template>

<script setup lang="ts">
import { watch } from 'vue';
import { RouterView, useRoute, useRouter } from 'vue-router';
import AppHeader from '@/components/AppHeader.vue';
import AppFooter from '@/components/AppFooter.vue';
import CartDrawer from '@/components/CartDrawer.vue';
import AuthModal from '@/components/AuthModal.vue';
import CheckoutModal from '@/components/CheckoutModal.vue';
import { useCartStore } from '@/stores/cart';
import { useUserStore } from '@/stores/user';
import { useAuthStore } from '@/stores/auth';
import { useUiStore } from '@/stores/ui';
import type { DeliveryServiceId, PickupPoint } from '@/types/pickup';

const cartStore = useCartStore();
const userStore = useUserStore();
const authStore = useAuthStore();
const uiStore = useUiStore();
const router = useRouter();
const route = useRoute();

const openCheckout = () => {
  uiStore.openCheckout();
};

const closeCheckout = () => {
  uiStore.closeCheckout();
};

const handleCheckoutSubmit = async (payload: { service: DeliveryServiceId; point: PickupPoint | null }) => {
  const orderPayload = {
    createdAt: new Date().toISOString(),
    number: `TEMP-${Date.now()}`,
    status: 'processing',
    total: {
      amount: cartStore.totalAmount,
      currency: cartStore.currency,
    },
    items: cartStore.lines.map((line) => ({
      productId: line.productId,
      quantity: line.quantity,
      price: line.price,
      title: `Товар ${line.productId}`,
    })),
    delivery: {
      service: payload.service,
      point: payload.point,
    },
  };

  try {
    const result = await userStore.createOrder(orderPayload);
    if (result === 'unauthorized') {
      redirectGuestToLogin('/cart/checkout');
      return;
    }
    cartStore.clear();
    closeCheckout();
    window.alert('Заказ создан! Мы уведомим вас по email.');
  } catch (error) {
    console.error('[Checkout] failed to create order', error);
    window.alert(error instanceof Error ? error.message : 'Не удалось оформить заказ.');
  }
};

const redirectGuestToLogin = async (redirectPath: string) => {
  authStore.setPostAuthRedirect(redirectPath);
  authStore.toggleModal(true);
  try {
    await router.push({ name: 'register_or_login', query: { redirect: redirectPath } });
  } catch (error) {
    console.warn('[Checkout] Failed to redirect guest', error);
  }
};

watch(
  () => route.name,
  (name) => {
    if (name === 'cart-checkout') {
      openCheckout();
    }
  },
  { immediate: true },
);
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
