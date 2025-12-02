<template>
  <div class="reset page-content">
    <section class="reset__card">
      <h1>Сброс пароля</h1>

      <template v-if="!token">
        <p>Токен восстановления не найден. Проверьте ссылку из письма.</p>
        <RouterLink to="/" class="reset__link">На главную</RouterLink>
      </template>

      <form v-else class="reset__form" @submit.prevent="submit">
        <p class="reset__info">
          Введите новый пароль для аккаунта, к которому принадлежит ссылка.
        </p>
        <label>
          Новый пароль
          <input v-model="newPassword" type="password" autocomplete="new-password" required />
        </label>
        <label>
          Повторите пароль
          <input v-model="confirmPassword" type="password" autocomplete="new-password" required />
        </label>
        <p v-if="errorMessage" class="reset__error">{{ errorMessage }}</p>
        <p v-if="successMessage" class="reset__info reset__info--success">{{ successMessage }}</p>
        <button type="submit" :disabled="isLoading">
          {{ isLoading ? 'Обновляем…' : 'Установить пароль' }}
        </button>
      </form>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const token = computed(() => (typeof route.query.token === 'string' ? route.query.token : ''));
const newPassword = ref('');
const confirmPassword = ref('');
const errorMessage = ref('');
const isLoading = ref(false);
const successMessage = ref('');

const submit = async () => {
  if (!token.value) {
    errorMessage.value = 'Токен отсутствует.';
    return;
  }
  if (newPassword.value !== confirmPassword.value) {
    errorMessage.value = 'Пароли не совпадают.';
    return;
  }
  if (!newPassword.value) {
    errorMessage.value = 'Введите новый пароль.';
    return;
  }

  errorMessage.value = '';
  isLoading.value = true;
  try {
    await authStore.resetPassword({ token: token.value, newPassword: newPassword.value });
    successMessage.value = 'Пароль обновлён. Теперь можно войти.';
    authStore.setPostAuthRedirect('/account');
    authStore.toggleModal(true);
    await router.push({ name: 'register_or_login', query: { redirect: '/account' } });
  } catch (error) {
    console.error('[ResetPassword]', error);
    errorMessage.value = authStore.authError ?? 'Не удалось обновить пароль.';
  } finally {
    isLoading.value = false;
  }
};
</script>

<style scoped lang="scss">
.reset {
  padding: var(--space-8) 0;
  display: flex;
  justify-content: center;
}

.reset__card {
  width: min(480px, 100%);
  background: var(--surface);
  padding: var(--space-6);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  display: grid;
  gap: var(--space-4);
}

.reset__form {
  display: grid;
  gap: var(--space-4);

  label {
    display: grid;
    gap: var(--space-2);
    font-weight: 600;
  }

  input {
    border-radius: var(--radius-md);
    border: 1px solid var(--border);
    padding: var(--space-2) var(--space-3);
    outline: none;
    min-height: 48px;

    &:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 2px rgba(255, 102, 0, 0.15);
    }
  }

  button {
    justify-self: flex-start;
    border: none;
    border-radius: var(--radius-md);
    background: var(--accent);
    color: #fff;
    padding: var(--space-3) var(--space-5);
    font-weight: 600;
    min-height: 52px;

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  }
}

.reset__info {
  margin: 0;
  color: var(--text-secondary);
}

.reset__info--success {
  color: var(--accent);
  font-weight: 600;
}

.reset__error {
  margin: 0;
  padding: var(--space-2);
  border-radius: var(--radius-sm);
  background: rgba(214, 69, 80, 0.1);
  color: var(--danger);
  font-size: var(--fz-caption);
}

.reset__link {
  color: var(--accent);
  font-weight: 600;
}

@media (max-width: $breakpoint-mobile) {
  .reset {
    padding-top: var(--space-5);
  }

  .reset__card {
    padding: var(--space-4);
    border-radius: var(--radius-md);
  }

  .reset__form button {
    width: 100%;
  }
}
</style>
