<template>
  <header class="header" :class="{ 'header--scrolled': isScrolled, 'header--menu-open': isMenuOpen }">
    <div class="header__top page-content">
      <RouterLink to="/" class="header__brand" aria-label="АВТОСИЛИКОН — на главную">
        <span class="header__brand-name">АВТОСИЛИКОН</span>
      </RouterLink>

      <nav class="header__nav" aria-label="Основная навигация">
        <RouterLink
          v-for="link in navLinks"
          :key="link.to"
          :to="link.to"
          class="header__link"
        >
          {{ link.label }}
        </RouterLink>
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

      <div class="header__compact-actions">
        <button
          class="header__icon-button header__icon-button--cart"
          type="button"
          aria-label="Открыть корзину"
          @click="cartStore.toggleCart(true)"
        >
          <span aria-hidden="true">🛒</span>
          <span class="header__badge" aria-live="polite">{{ cartStore.itemCount }}</span>
        </button>
        <button
          class="header__burger"
          type="button"
          :aria-expanded="isMenuOpen ? 'true' : 'false'"
          aria-label="Открыть меню"
          @click="toggleMenu()"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>
    </div>

    <transition name="header-fade">
      <div v-if="isMenuOpen" class="header__mobile-overlay" @click="toggleMenu(false)"></div>
    </transition>
    <transition name="header-slide">
      <section v-if="isMenuOpen" class="header__mobile-menu" aria-label="Мобильная навигация">
        <div class="header__mobile-head">
          <span>Навигация</span>
          <button type="button" aria-label="Закрыть меню" @click="toggleMenu(false)">✕</button>
        </div>
        <nav class="header__mobile-nav">
          <RouterLink
            v-for="link in navLinks"
            :key="link.to"
            :to="link.to"
            class="header__mobile-link"
            @click="closeMenu"
          >
            {{ link.label }}
          </RouterLink>
        </nav>
        <div class="header__mobile-auth">
          <template v-if="authStore.isAuthenticated">
            <button type="button" class="header__mobile-action" @click="openAccount">
              Личный кабинет
            </button>
            <button
              type="button"
              class="header__mobile-action header__mobile-action--ghost"
              @click="logout"
            >
              Выйти
            </button>
          </template>
          <template v-else>
            <div class="header__mobile-auth-grid">
              <button type="button" class="header__mobile-action" @click="openLogin">
                Войти
              </button>
              <button
                type="button"
                class="header__mobile-action header__mobile-action--ghost"
                @click="openRegister"
              >
                Регистрация
              </button>
            </div>
          </template>
        </div>
      </section>
    </transition>
  </header>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter, useRoute, RouterLink } from 'vue-router';
import { useCartStore } from '@/stores/cart';
import { useAuthStore } from '@/stores/auth';
const router = useRouter();
const route = useRoute();
const cartStore = useCartStore();
const authStore = useAuthStore();

const isScrolled = ref(false);
const isMenuOpen = ref(false);
const DESKTOP_BREAKPOINT = 1024;

const navLinks = [
  { to: '/catalog', label: 'Каталог' },
  { to: '/articles', label: 'Новости' },
  { to: '/about', label: 'О компании' },
  { to: '/contacts', label: 'Контакты' },
];

const formattedTotal = computed(() => {
  const amount = cartStore.totalAmount.toLocaleString('ru-RU', {
    style: 'currency',
    currency: cartStore.currency,
    maximumFractionDigits: 0,
  });
  return amount;
});

const closeMenu = () => {
  isMenuOpen.value = false;
};

const toggleMenu = (force?: boolean) => {
  isMenuOpen.value = typeof force === 'boolean' ? force : !isMenuOpen.value;
};

const handleAuthTap = () => {
  closeMenu();
  if (authStore.isAuthenticated) {
    router.push({ name: 'account' });
    return;
  }
  authStore.toggleModal(true, 'login');
};

const openLogin = () => {
  closeMenu();
  authStore.toggleModal(true, 'login');
};

const openRegister = () => {
  closeMenu();
  authStore.toggleModal(true, 'register');
};

const openAccount = () => {
  closeMenu();
  router.push({ name: 'account' });
};

const logout = async () => {
  closeMenu();
  await authStore.logout();
  router.push({ name: 'home' });
};

const handleScroll = () => {
  isScrolled.value = window.scrollY > 10;
};

const handleResize = () => {
  if (window.innerWidth > DESKTOP_BREAKPOINT && isMenuOpen.value) {
    closeMenu();
  }
};

onMounted(() => {
  window.addEventListener('scroll', handleScroll, { passive: true });
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll);
  window.removeEventListener('resize', handleResize);
});

watch(
  () => route.fullPath,
  () => {
    closeMenu();
  },
);
</script>

<style scoped lang="scss">
.header {
  position: sticky;
  inset: 0 0 auto 0;
  z-index: 200;
  background: linear-gradient(90deg, var(--brand-primary), var(--accent));
  padding: var(--space-4) 0;
  min-height: 64px;
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

.header__compact-actions {
  display: none;
  align-items: center;
  gap: var(--space-2);
  margin-left: auto;
}

.header__icon-button {
  position: relative;
  width: 44px;
  height: 44px;
  border-radius: var(--radius-md);
  border: 1px solid rgba(255, 255, 255, 0.4);
  background: transparent;
  color: #fff;
  font-size: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background-color 120ms ease-out, border-color 120ms ease-out;

  &:hover,
  &:focus-visible {
    background: rgba(255, 255, 255, 0.15);
    border-color: transparent;
  }
}

.header__badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 20px;
  height: 20px;
  border-radius: 999px;
  background: var(--accent);
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.header__burger {
  width: 46px;
  height: 46px;
  border-radius: var(--radius-md);
  border: 1px solid rgba(255, 255, 255, 0.4);
  background: transparent;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 6px;
  padding: 0 var(--space-2);
  transition: background-color 120ms ease-out, border-color 120ms ease-out;

  span {
    width: 100%;
    height: 2px;
    background: #fff;
    transition: transform 160ms ease, opacity 160ms ease;
  }

  &:hover,
  &:focus-visible {
    background: rgba(255, 255, 255, 0.15);
    border-color: transparent;
  }
}

.header--menu-open .header__burger span:nth-child(1) {
  transform: translateY(4px) rotate(45deg);
}

.header--menu-open .header__burger span:nth-child(2) {
  opacity: 0;
}

.header--menu-open .header__burger span:nth-child(3) {
  transform: translateY(-4px) rotate(-45deg);
}

.header__mobile-overlay {
  position: fixed;
  inset: 0;
  background: rgba(8, 17, 40, 0.5);
  z-index: 150;
}

.header__mobile-menu {
  position: fixed;
  top: 0;
  right: 0;
  width: min(320px, 80vw);
  height: 100vh;
  background: var(--surface);
  color: var(--text-primary);
  padding: var(--space-6) var(--space-4);
  box-shadow: -12px 0 32px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  z-index: 200;
}

.header__mobile-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 600;

  button {
    border: none;
    background: transparent;
    font-size: 24px;
    line-height: 1;
  }
}

.header__mobile-nav {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.header__mobile-link {
  padding: var(--space-3);
  border-radius: var(--radius-md);
  font-weight: 600;
  color: var(--brand-primary);
  background: rgba(0, 87, 184, 0.08);

  &:hover {
    background: rgba(0, 87, 184, 0.12);
  }
}

.header__mobile-auth {
  margin-top: auto;
  display: grid;
  gap: var(--space-2);
}

.header__mobile-auth-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-2);
}

.header__mobile-action {
  width: 100%;
  border-radius: var(--radius-md);
  border: none;
  padding: var(--space-3);
  font-weight: 600;
  background: var(--accent);
  color: #fff;
  min-height: 48px;
}

.header__mobile-action--ghost {
  background: rgba(0, 0, 0, 0.05);
  color: var(--text-primary);
}

.header-fade-enter-active,
.header-fade-leave-active {
  transition: opacity 160ms ease;
}

.header-fade-enter-from,
.header-fade-leave-to {
  opacity: 0;
}

.header-slide-enter-active,
.header-slide-leave-active {
  transition: transform 200ms ease;
}

.header-slide-enter-from,
.header-slide-leave-to {
  transform: translateX(100%);
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

@media (max-width: 1024px) {
  .header {
    padding: var(--space-3) 0;
  }

  .header__nav,
  .header__actions {
    display: none;
  }

  .header__compact-actions {
    display: inline-flex;
  }

  .header__top {
    gap: var(--space-2);
  }

  .header__brand {
    margin-right: auto;
  }
}

@media (min-width: 768px) and (max-width: 1200px) {
  .header {
    min-height: 72px;
  }

  .header__brand-name {
    font-size: 28px;
  }

  .header__icon-button,
  .header__burger {
    width: 54px;
    height: 54px;
    font-size: 24px;
  }

  .header__burger span {
    height: 3px;
  }
}

@media (max-width: $breakpoint-mobile) {
  .header__mobile-menu {
    width: 100%;
    max-width: none;
  }
}
</style>
