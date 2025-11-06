<template>
  <div class="account-page container">
    <section v-if="!authStore.isAuthenticated" class="account-page__unauth">
      <h1>Войдите в личный кабинет</h1>
      <p>Для доступа к данным аккаунта необходимо авторизоваться.</p>
      <button type="button" @click="authStore.toggleModal(true)">Войти</button>
    </section>
    <UserAccount v-else />
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '@/stores/auth';
import UserAccount from '@/components/account/UserAccount.vue';

const authStore = useAuthStore();
</script>

<style scoped lang="scss">
.account-page {
  padding-top: var(--space-6);
  padding-bottom: var(--space-8);
}

.account-page__unauth {
  background: var(--surface);
  padding: var(--space-6);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  display: grid;
  gap: var(--space-3);

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
