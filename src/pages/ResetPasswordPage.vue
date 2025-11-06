<template>
  <div class="reset container">
    <section class="reset__card">
      <h1>Сброс пароля</h1>

      <template v-if="!token">
        <p>Токен восстановления не найден. Проверьте ссылку из письма.</p>
        <RouterLink to="/" class="reset__link">На главную</RouterLink>
      </template>

      <template v-else-if="!tokenEntry">
        <p>Ссылка для восстановления устарела или недействительна.</p>
        <RouterLink to="/" class="reset__link">Запросить новую ссылку</RouterLink>
      </template>

      <form v-else class="reset__form" @submit.prevent="submit">
        <p class="reset__info">
          Сбрасываем пароль для аккаунта <strong>{{ tokenEntry.email }}</strong>
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
        <button type="submit" :disabled="isLoading">Установить пароль</button>
      </form>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const token = computed(() => (typeof route.query.token === 'string' ? route.query.token : ''));
const tokenEntry = ref<ReturnType<typeof authStore.validateResetToken>>(null);
const newPassword = ref('');
const confirmPassword = ref('');
const errorMessage = ref('');
const isLoading = ref(false);

watchEffect(() => {
  if (!token.value) {
    tokenEntry.value = null;
    return;
  }
  tokenEntry.value = authStore.validateResetToken(token.value);
});

const submit = async () => {
  if (!token.value || !tokenEntry.value) return;
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
    await authStore.resetPasswordWithToken({
      token: token.value,
      newPassword: newPassword.value,
    });
    await router.replace({ name: 'account' });
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
  }

  button {
    justify-self: flex-start;
    border: none;
    border-radius: var(--radius-md);
    background: var(--accent);
    color: #fff;
    padding: var(--space-3) var(--space-5);
    font-weight: 600;

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
</style>
