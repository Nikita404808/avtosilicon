<template>
  <header class="header" :class="{ 'header--scrolled': isScrolled }">
    <div class="header__top container">
      <RouterLink to="/" class="header__brand" aria-label="АВТОСИЛИКОН — на главную">
        <span class="header__brand-name">АВТОСИЛИКОН</span>
      </RouterLink>

      <nav class="header__nav" aria-label="Основная навигация">
        <RouterLink to="/catalog" class="header__link">Каталог</RouterLink>
        <RouterLink to="/articles" class="header__link">Новости</RouterLink>
        <RouterLink to="/about" class="header__link">О компании</RouterLink>
        <RouterLink to="/contacts" class="header__link">Контакты</RouterLink>
      </nav>

      <div class="header__actions">
        <div class="header__user-actions">
          <div class="header__auth-group">
            <button class="header__auth" type="button" @click="handleAuthTap">
              <span class="header__auth-icon" aria-hidden="true">👤</span>
              <span>{{ authStore.isAuthenticated ? 'Личный кабинет' : 'Войти' }}</span>
            </button>
            <button
              v-if="authStore.isAuthenticated"
              class="header__logout"
              type="button"
              @click="logout"
            >
              Выйти
            </button>
          </div>

          <button class="header__cart" type="button" @click="cartStore.toggleCart(true)">
            <span class="header__cart-icon" aria-hidden="true">🛒</span>
            <div class="header__cart-info">
              <span class="header__cart-label">Корзина</span>
              <span v-if="cartStore.hasItems" class="header__cart-total">
                {{ formattedTotal }}
              </span>
              <span class="header__cart-count" aria-live="polite">
                {{ cartStore.itemCount }}
              </span>
            </div>
          </button>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRouter, RouterLink } from 'vue-router';
import { useCartStore } from '@/stores/cart';
import { useAuthStore } from '@/stores/auth';
const router = useRouter();
const cartStore = useCartStore();
const authStore = useAuthStore();

const isScrolled = ref(false);

const formattedTotal = computed(() => {
  const amount = cartStore.totalAmount.toLocaleString('ru-RU', {
    style: 'currency',
    currency: cartStore.currency,
    maximumFractionDigits: 0,
  });
  return amount;
});

const handleAuthTap = () => {
  if (authStore.isAuthenticated) {
    router.push({ name: 'account' });
    return;
  }
  authStore.toggleModal(true);
};

const logout = async () => {
  await authStore.logout();
  router.push({ name: 'home' });
};

const handleScroll = () => {
  isScrolled.value = window.scrollY > 10;
};

onMounted(() => {
  window.addEventListener('scroll', handleScroll, { passive: true });
});

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll);
});
</script>

<style scoped lang="scss">
.header {
  position: sticky;
  inset: 0 0 auto 0;
  z-index: 100;
  background: linear-gradient(90deg, var(--brand-primary), var(--accent));
  padding: var(--space-4) 0;
  transition: box-shadow 160ms ease-out, padding 160ms ease-out;

  &--scrolled {
    padding: var(--space-2) 0;
    box-shadow: var(--shadow-md);
  }
}

.header__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding-inline: 0;

  @media (max-width: $breakpoint-laptop) {
    flex-wrap: wrap;
    justify-content: center;
    gap: var(--space-2);
  }
}

.header__brand {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  flex: 0 0 auto;
  margin-left: clamp(4px, 1vw, 12px);
  margin-right: var(--space-3);
}

.header__brand-name {
  font-weight: 700;
  font-size: 24px;
  letter-spacing: 0.06em;
  color: #fff;
  text-transform: uppercase;
}

.header__nav {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  font-weight: 500;
  color: #eef4ff;
  flex: 1 1 0;
  justify-content: center;
  min-width: 0;
  white-space: nowrap;
  padding-inline: var(--space-2);

  @media (max-width: $breakpoint-laptop) {
    order: 3;
    flex-wrap: wrap;
    justify-content: center;
    gap: var(--space-2);
    white-space: normal;
  }
}

.header__link {
  padding: var(--space-2) var(--space-2);
  border-radius: var(--radius-sm);
  transition: background-color 120ms ease-out, color 120ms ease-out;

  &:hover,
  &:focus-visible {
    background-color: rgba(255, 255, 255, 0.15);
    color: #fff;
  }
}

.header__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-2);
  flex: 0 0 auto;
  margin-left: var(--space-3);

  @media (max-width: $breakpoint-laptop) {
    width: min(100%, 480px);
    flex-direction: column;
    gap: var(--space-2);
  }
}

.header__user-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: nowrap;

  @media (max-width: $breakpoint-tablet) {
    flex-wrap: wrap;
    justify-content: center;
  }
}

.header__auth,
.header__cart {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  border: none;
  background: transparent;
  color: #fff;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  transition: background-color 120ms ease-out;

  &:hover,
  &:focus-visible {
    background-color: rgba(255, 255, 255, 0.1);
  }
}

.header__auth-group {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.12);
  white-space: nowrap;
}

.header__logout {
  border: none;
  background: rgba(0, 0, 0, 0.2);
  color: #fff;
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-sm);
  font-size: var(--fz-caption);

  &:hover,
  &:focus-visible {
    background: rgba(0, 0, 0, 0.18);
  }
}

.header__cart {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  background: rgba(255, 255, 255, 0.1);
  padding: var(--space-1) var(--space-4) var(--space-1) var(--space-3);
  border-radius: var(--radius-md);
}

.header__cart-info {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  font-size: var(--fz-caption);
  line-height: var(--lh-caption);
}

.header__cart-label {
  opacity: 0.8;
}

.header__cart-total {
  font-weight: 600;
  font-size: var(--fz-body);
  line-height: var(--lh-body);
}

.header__cart-count {
  position: absolute;
  top: -6px;
  right: -6px;
  min-width: 22px;
  height: 22px;
  border-radius: 999px;
  background: var(--brand-primary);
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 14px;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}
</style>
