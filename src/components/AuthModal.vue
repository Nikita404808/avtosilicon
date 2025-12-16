<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="authStore.isAuthModalOpen" class="modal" role="dialog" aria-modal="true">
        <div class="modal__backdrop" @click="closeModal" />
        <div class="modal__content page-content" ref="modalRef" tabindex="-1">
          <header class="modal__header">
            <h2>{{ mode === 'register' ? 'Регистрация' : 'Вход в личный кабинет' }}</h2>
            <button type="button" @click="closeModal" aria-label="Закрыть">
              ✕
            </button>
          </header>
          <form class="modal__form" @submit.prevent="submit">
            <label for="email">Email</label>
            <input
              id="email"
              v-model.trim="email"
              type="email"
              autocomplete="email"
              :disabled="isLoading"
              required
            />

            <label for="password">Пароль</label>
            <div class="modal__input-wrapper">
              <input
                id="password"
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                autocomplete="current-password"
                :disabled="isLoading"
                required
              />
              <button
                type="button"
                class="modal__toggle"
                :aria-pressed="String(showPassword)"
                :aria-label="showPassword ? 'Скрыть пароль' : 'Показать пароль'"
                @click="showPassword = !showPassword"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    v-if="!showPassword"
                    d="M12 5c-4.5 0-8.5 2.8-10.5 7 2 4.2 6 7 10.5 7s8.5-2.8 10.5-7C20.5 7.8 16.5 5 12 5zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8z"
                  />
                  <path
                    v-else
                    d="M2 5.3 3.3 4l16.4 16.4-1.3 1.3-3.4-3.4A11.5 11.5 0 0 1 12 19c-4.5 0-8.5-2.8-10.5-7 1-2 2.5-3.7 4.4-5zm9.1 1.1c4-.2 7.7 2 9.9 5.9-.8 1.6-1.9 3-3.3 4.1l-2.6-2.6a4 4 0 0 0-4.9-4.9z"
                  />
                </svg>
              </button>
            </div>

            <label v-if="mode === 'register'" for="password-confirm">Повторите пароль</label>
            <div v-if="mode === 'register'" class="modal__input-wrapper">
              <input
                id="password-confirm"
                v-model="confirmPassword"
                :type="showConfirmPassword ? 'text' : 'password'"
                autocomplete="new-password"
                :disabled="isLoading"
                required
              />
              <button
                type="button"
                class="modal__toggle"
                :aria-pressed="String(showConfirmPassword)"
                :aria-label="showConfirmPassword ? 'Скрыть пароль' : 'Показать пароль'"
                @click="showConfirmPassword = !showConfirmPassword"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    v-if="!showConfirmPassword"
                    d="M12 5c-4.5 0-8.5 2.8-10.5 7 2 4.2 6 7 10.5 7s8.5-2.8 10.5-7C20.5 7.8 16.5 5 12 5zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8z"
                  />
                  <path
                    v-else
                    d="M2 5.3 3.3 4l16.4 16.4-1.3 1.3-3.4-3.4A11.5 11.5 0 0 1 12 19c-4.5 0-8.5-2.8-10.5-7 1-2 2.5-3.7 4.4-5zm9.1 1.1c4-.2 7.7 2 9.9 5.9-.8 1.6-1.9 3-3.3 4.1l-2.6-2.6a4 4 0 0 0-4.9-4.9z"
                  />
                </svg>
              </button>
            </div>

            <div v-if="mode === 'register'" class="modal__policy">
              <label class="modal__checkbox">
                <input type="checkbox" v-model="acceptedPolicy" />
                <span>
                  Принимаю
                  <RouterLink to="/policy">Политику конфиденциальности</RouterLink>
                </span>
              </label>
            </div>

            <p v-if="errorMessage" class="modal__error">{{ errorMessage }}</p>

            <button type="submit" :disabled="isLoading">
              {{ primaryActionLabel }}
            </button>

            <div v-if="mode === 'login'" class="modal__inline-actions">
              <button type="button" class="modal__ghost-button" @click="openReset" :disabled="isLoading">
                Забыли пароль?
              </button>
              <div class="modal__create-account">
                <button
                  type="button"
                  class="modal__ghost-button modal__ghost-button--compact"
                  @click="switchMode"
                  :disabled="isLoading"
                >
                  Зарегистрироваться
                </button>
                <small>Нет аккаунта?</small>
              </div>
            </div>
          </form>
          <div v-if="mode === 'register'" class="modal__switch">
            <span>Уже зарегистрированы?</span>
            <button
              type="button"
              class="modal__ghost-button modal__ghost-button--compact"
              @click="switchMode"
              :disabled="isLoading"
            >
              Войти
            </button>
          </div>
        </div>
      </div>
    </Transition>
    <Transition name="modal">
      <div v-if="showResetModal" class="modal" role="dialog" aria-modal="true">
        <div class="modal__backdrop" @click="closeReset" />
        <div class="modal__content page-content" ref="resetModalRef" tabindex="-1">
          <header class="modal__header">
            <h2>Восстановление пароля</h2>
            <button type="button" @click="closeReset" aria-label="Закрыть">
              ✕
            </button>
          </header>
          <form class="modal__form" @submit.prevent="submitReset">
            <label for="reset-email">Email</label>
            <input
              id="reset-email"
              v-model.trim="resetEmail"
              type="email"
              autocomplete="email"
              required
            />
            <p v-if="resetMessage" class="modal__hint">{{ resetMessage }}</p>
            <button type="submit" :disabled="isResetLoading">
              {{ isResetLoading ? 'Отправляем…' : 'Отправить ссылку' }}
            </button>
          </form>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const authStore = useAuthStore();

const email = ref('');
const password = ref('');
const confirmPassword = ref('');
const modalRef = ref<HTMLDivElement | null>(null);
const showResetModal = ref(false);
const resetEmail = ref('');
const resetModalRef = ref<HTMLDivElement | null>(null);
const mode = ref<'login' | 'register'>(authStore.authModalMode ?? 'login');
const formError = ref('');
const isLoading = ref(false);
const showPassword = ref(false);
const showConfirmPassword = ref(false);
const resetMessage = ref('');
const isResetLoading = ref(false);
const acceptedPolicy = ref(false);

const errorMessage = computed(() => formError.value || authStore.authError);
const primaryActionLabel = computed(() =>
  mode.value === 'register' ? 'Зарегистрироваться' : 'Войти',
);

const submit = async () => {
  formError.value = '';
  authStore.setError(null);

  if (!email.value || !password.value) {
    formError.value = 'Введите email и пароль.';
    return;
  }

  if (mode.value === 'register' && password.value !== confirmPassword.value) {
    formError.value = 'Пароли не совпадают.';
    return;
  }

  if (mode.value === 'register' && !acceptedPolicy.value) {
    formError.value = 'Для регистрации необходимо принять политику конфиденциальности.';
    return;
  }

  isLoading.value = true;
  try {
    if (mode.value === 'register') {
      await authStore.register({ email: email.value, password: password.value });
    } else {
      await authStore.login({ email: email.value, password: password.value });
    }
    resetForm();
  } catch (error) {
    console.warn('[AuthModal]', error);
  } finally {
    isLoading.value = false;
  }
};

const openReset = () => {
  showResetModal.value = true;
  resetEmail.value = email.value;
};

const closeReset = () => {
  showResetModal.value = false;
  resetEmail.value = '';
  resetMessage.value = '';
  formError.value = '';
};

const submitReset = async () => {
  formError.value = '';
  resetMessage.value = '';
  if (!resetEmail.value) {
    formError.value = 'Введите email.';
    return;
  }
  isResetLoading.value = true;
  try {
    await authStore.requestPasswordReset(resetEmail.value);
    resetMessage.value = 'Ссылка для сброса пароля отправлена на вашу почту.';
    setTimeout(() => {
      resetMessage.value = '';
      closeReset();
    }, 2000);
  } catch (error) {
    console.warn('[AuthModal:reset]', error);
    formError.value = authStore.authError ?? 'Не удалось создать ссылку восстановления.';
  } finally {
    isResetLoading.value = false;
  }
};

const switchMode = () => {
  mode.value = mode.value === 'login' ? 'register' : 'login';
  authStore.setModalMode(mode.value);
  formError.value = '';
  authStore.setError(null);
  password.value = '';
  confirmPassword.value = '';
  acceptedPolicy.value = false;
};

const closeModal = () => {
  authStore.toggleModal(false);
};

const resetForm = () => {
  email.value = '';
  password.value = '';
  confirmPassword.value = '';
  formError.value = '';
  authStore.setError(null);
  acceptedPolicy.value = false;
};

watch(
  () => authStore.isAuthModalOpen,
  (isOpen) => {
    document.body.style.overflow = isOpen || showResetModal.value ? 'hidden' : '';
    if (isOpen) {
      mode.value = authStore.authModalMode ?? 'login';
      requestAnimationFrame(() => {
        modalRef.value?.focus();
      });
    } else {
      showResetModal.value = false;
      mode.value = 'login';
      authStore.setModalMode('login');
      resetForm();
    }
  },
);

watch(
  () => authStore.authModalMode,
  (next) => {
    mode.value = next ?? 'login';
  },
);

watch(showResetModal, (isOpen) => {
  document.body.style.overflow = isOpen || authStore.isAuthModalOpen ? 'hidden' : '';
  if (isOpen) {
    requestAnimationFrame(() => {
      resetModalRef.value?.focus();
    });
  }
});
</script>

<style scoped lang="scss">
.modal {
  position: fixed;
  inset: 0;
  z-index: 300;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(19, 0, 21, 0.6);
}

.modal__content {
  position: relative;
  width: min(480px, calc(100vw - 32px));
  background: var(--surface);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  box-shadow: var(--shadow-lg);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  outline: none;
  margin-inline: auto;
}

.modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;

  button {
    border: none;
    background: transparent;
    font-size: 20px;
  }
}

.modal__form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);

  label {
    font-weight: 600;
  }

  input {
    border-radius: var(--radius-md);
    border: 1px solid var(--border);
    padding: var(--space-2) var(--space-3);
    outline: none;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
    min-height: 48px;

    &:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px rgba(255, 102, 0, 0.2);
    }
  }

  > button:not(.modal__ghost-button) {
    margin-top: var(--space-4);
    border-radius: var(--radius-md);
    border: none;
    background: var(--accent);
    color: #fff;
    padding: var(--space-3) var(--space-5);
    font-weight: 600;
    outline: none;
    transition: box-shadow 0.15s ease, transform 0.02s ease;
    min-height: 52px;

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    &:focus-visible {
      box-shadow: 0 0 0 3px rgba(255, 102, 0, 0.25);
    }
  }
}

.modal__error {
  margin: 0;
  padding: var(--space-2);
  border-radius: var(--radius-sm);
  background: rgba(214, 69, 80, 0.1);
  color: var(--danger);
  font-size: var(--fz-caption);
}

.modal__hint {
  margin: 0;
  color: var(--text-secondary);
  font-size: var(--fz-caption);
}

.modal__switch {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: var(--space-3);
  width: 100%;

  span {
    font-weight: 600;
    color: var(--text-secondary);
  }
}

.modal__input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0;
  width: 100%;
  padding: 0;
}

.modal__inline-actions {
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  gap: var(--space-2);
  flex-wrap: nowrap;
  margin-top: var(--space-2);
  width: 100%;
  padding-left: var(--space-2);

  .modal__ghost-button {
    margin-top: 0;
  }
}

.modal__create-account {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
}

.modal__create-account small {
  display: block;
  font-size: var(--fz-caption);
  color: var(--text-secondary);
  text-align: center;
}

.modal__policy {
  margin-top: var(--space-1);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding-left: 0;
}

.modal__checkbox {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--fz-caption);
  color: var(--text-secondary);
  margin-left: -4px;

  input {
    margin-top: 0;
    width: 18px;
    height: 18px;
    outline: none;
    box-shadow: none;
    border: 1px solid var(--border);
    border-radius: 4px;
    accent-color: var(--accent);

    &:focus-visible,
    &:focus {
      outline: none;
      box-shadow: none;
      border-color: var(--border);
    }
  }

  a {
    color: var(--accent);
    text-decoration: underline;
  }

  span {
    line-height: 1.4;
  }
}

.modal__input-wrapper .modal__toggle {
  position: absolute;
  right: var(--space-2);
  top: 50%;
  transform: translateY(-50%);
  width: 36px;
  height: 36px;
  padding: 0;
}

.modal__input-wrapper input {
  flex: 1;
  width: 100%;
  padding-left: var(--space-3);
  padding-right: calc(36px + var(--space-2) + var(--space-1));
  max-width: 100%;
}

@media (max-width: 480px) {
  .modal__inline-actions {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-2);
    padding-left: 0;

    .modal__ghost-button {
      width: auto;
      text-align: left;
    }
  }

  .modal__create-account {
    flex-direction: row;
    align-items: center;
    justify-content: flex-start;
    gap: var(--space-2);
    width: auto;
  }

  .modal__create-account small {
    margin-left: var(--space-2);
  }
}

.modal__toggle {
  border: 1px solid var(--border);
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.04);
  cursor: pointer;
  border-radius: var(--radius-sm);
  outline: none;

  svg {
    width: 20px;
    height: 20px;
    fill: currentColor;
    opacity: 0.8;
  }

  &:focus-visible {
    box-shadow: 0 0 0 3px rgba(255, 102, 0, 0.25);
  }
}

.modal__ghost-button {
  align-self: flex-start;
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-secondary);
  padding: var(--space-1) var(--space-2);
  font-weight: 600;
  margin-top: var(--space-2);
  font-size: var(--fz-caption);

  &--compact {
    margin-top: 0;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &:focus-visible {
    box-shadow: 0 0 0 3px rgba(255, 102, 0, 0.25);
  }
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
  transform: scale(0.95);
}

.modal-enter-active,
.modal-leave-active {
  transition: all 160ms ease;
}

@media (max-width: $breakpoint-tablet) {
  .modal__content {
    width: min(440px, calc(100vw - 48px));
    padding: var(--space-5);
  }
}

@media (max-width: $breakpoint-mobile) {
  .modal {
    align-items: flex-start;
    padding: var(--space-4) var(--space-3);
  }

  .modal__content {
    width: 100%;
    border-radius: var(--radius-md);
    padding: var(--space-4);
  }
}
</style>
