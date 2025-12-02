<template>
  <section class="auth-redirect page-content">
    <h1>Вход или регистрация</h1>
    <p>
      Чтобы продолжить, авторизуйтесь. После входа мы вернём вас на страницу
      <strong>{{ redirectLabel }}</strong>.
    </p>
    <button type="button" @click="openAuth">Открыть окно входа</button>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const route = useRoute();
const authStore = useAuthStore();

const redirectPath = computed(() => {
  const queryValue = route.query.redirect;
  return typeof queryValue === 'string' ? queryValue : '/account';
});

const redirectLabel = computed(() => redirectPath.value);

const openAuth = () => {
  authStore.toggleModal(true);
};

onMounted(() => {
  authStore.setPostAuthRedirect(redirectPath.value);
  authStore.toggleModal(true);
});

watch(
  () => redirectPath.value,
  (next) => {
    authStore.setPostAuthRedirect(next);
  },
);
</script>

<style scoped lang="scss">
.auth-redirect {
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
