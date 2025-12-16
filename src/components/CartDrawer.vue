<template>
  <Transition name="drawer">
    <aside
      v-if="cartStore.isOpen"
      class="drawer"
      role="dialog"
      aria-modal="true"
      aria-label="Корзина"
      @keydown.esc="cartStore.toggleCart(false)"
    >
      <div class="drawer__backdrop" @click="cartStore.toggleCart(false)" />
      <div class="drawer__panel" ref="panelRef" tabindex="-1">
        <header class="drawer__header">
          <h2>Корзина</h2>
          <button type="button" @click="cartStore.toggleCart(false)" aria-label="Закрыть корзину">
            ✕
          </button>
        </header>

        <section class="drawer__body" v-if="cartStore.hasItems">
          <article v-for="line in cartStore.lines" :key="line.productId" class="drawer__line">
            <div class="drawer__line-info">
              <h3>{{ line.title || `Товар ${line.productId}` }}</h3>
              <p>{{ formatMoney(line.price) }}</p>
              <p class="drawer__line-weight">Вес: {{ formatWeight(line.weight, line.quantity) }}</p>
            </div>
            <div class="drawer__line-actions">
              <label class="sr-only" :for="`qty-${line.productId}`">Количество</label>
              <input
                :id="`qty-${line.productId}`"
                type="number"
                min="1"
                :value="line.quantity"
                @input="onQuantityChange(line.productId, $event)"
              />
              <button type="button" @click="cartStore.removeItem(line.productId)">Удалить</button>
            </div>
          </article>
        </section>
        <section v-else class="drawer__empty">
          <p>В вашей корзине пока пусто.</p>
        </section>

        <footer class="drawer__footer">
          <div class="drawer__totals">
            <div>
              <span>Итого</span>
              <strong>{{ formattedTotal }}</strong>
            </div>
            <div class="drawer__weight">
              <span>Вес</span>
              <strong>{{ formattedTotalWeight }}</strong>
            </div>
          </div>
          <button type="button" class="drawer__checkout" @click="proceedToCheckout" :disabled="!cartStore.hasItems">
            Оформить заказ
          </button>
        </footer>
      </div>
    </aside>
  </Transition>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watchEffect } from 'vue';
import { useCartStore } from '@/stores/cart';

const cartStore = useCartStore();
const panelRef = ref<HTMLDivElement | null>(null);
const emit = defineEmits<{
  (event: 'checkout'): void;
}>();

const formattedTotal = computed(() =>
  cartStore.totalAmount.toLocaleString('ru-RU', {
    style: 'currency',
    currency: cartStore.currency,
    maximumFractionDigits: 0,
  }),
);

const formattedTotalWeight = computed(() => {
  if (!cartStore.totalWeight) return '—';
  return `${cartStore.totalWeight.toLocaleString('ru-RU', {
    maximumFractionDigits: 3,
  })} кг`;
});

const lockBodyScroll = (shouldLock: boolean) => {
  document.body.style.overflow = shouldLock ? 'hidden' : '';
};

const handleFocusTrap = (event: KeyboardEvent) => {
  if (event.key !== 'Tab' || !panelRef.value) return;

  const focusable = panelRef.value.querySelectorAll<HTMLElement>(
    'button, input, [href], select, textarea, [tabindex]:not([tabindex="-1"])',
  );
  if (!focusable.length) return;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
};

const onQuantityChange = (productId: string, event: Event) => {
  const target = event.target as HTMLInputElement;
  cartStore.updateQuantity(productId, Number(target.value));
};

const formatMoney = ({ amount, currency }: { amount: number; currency: string }) =>
  amount.toLocaleString('ru-RU', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  });

const formatWeight = (unitWeight: number, quantity: number) => {
  const weight = Number.isFinite(unitWeight) ? Math.max(0, unitWeight) : 0;
  const qty = Math.max(1, quantity);
  const total = weight * qty;
  if (!total) return '—';
  return `${total.toLocaleString('ru-RU', { maximumFractionDigits: 3 })} кг`;
};

const proceedToCheckout = () => {
  if (!cartStore.hasItems) return;
  cartStore.toggleCart(false);
  emit('checkout');
};

onMounted(() => {
  watchIsOpen(true);
});

onUnmounted(() => {
  watchIsOpen(false);
});

let stopWatcher: (() => void) | null = null;

const watchIsOpen = (isMounted: boolean) => {
  if (isMounted) {
    stopWatcher = watchEffect(() => {
      lockBodyScroll(cartStore.isOpen);
      if (cartStore.isOpen) {
        requestAnimationFrame(() => {
          panelRef.value?.focus();
        });
      }
    });
    window.addEventListener('keydown', handleFocusTrap);
    return;
  }

  stopWatcher?.();
  stopWatcher = null;
  lockBodyScroll(false);
  window.removeEventListener('keydown', handleFocusTrap);
};
</script>

<style scoped lang="scss">
.drawer {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
}

.drawer__backdrop {
  flex: 1;
  background: rgba(19, 0, 21, 0.6);
}

.drawer__panel {
  width: min(420px, 90vw);
  background: var(--surface);
  border-radius: var(--radius-lg) 0 0 var(--radius-lg);
  display: flex;
  flex-direction: column;
  max-height: 100vh;
  margin-left: auto;
  padding: var(--space-5);
  gap: var(--space-5);
  box-shadow: var(--shadow-lg);
  outline: none;
}

.drawer__header {
  display: flex;
  align-items: center;
  justify-content: space-between;

  button {
    border: none;
    background: transparent;
    font-size: 20px;
  }
}

.drawer__body {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  overflow-y: auto;
  padding-right: var(--space-1);
}

.drawer__line {
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3);
  border-radius: var(--radius-md);
  background-color: rgba(0, 0, 0, 0.03);
}

.drawer__line-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.drawer__line-weight {
  color: var(--text-secondary);
}

.drawer__line-actions {
  display: flex;
  gap: var(--space-2);
  align-items: center;

  input {
    width: 72px;
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
  }

  button {
    background: none;
    border: none;
    color: var(--danger);
  }
}

.drawer__empty {
  text-align: center;
  color: var(--text-secondary);
  padding: var(--space-6) 0;
}

.drawer__footer {
  margin-top: auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-4);

  .drawer__totals {
    display: grid;
    gap: var(--space-2);
  }

  .drawer__totals > div {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
  }

  strong {
    font-size: 20px;
  }
}

.drawer__checkout {
  padding: var(--space-3) var(--space-5);
  border-radius: var(--radius-md);
  background: var(--accent);
  color: #fff;
  border: none;
  font-weight: 600;
}

.drawer-enter-from,
.drawer-leave-to {
  opacity: 0;
  transform: translateX(100%);
}

.drawer-enter-active,
.drawer-leave-active {
  transition: all 200ms ease;
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

@media (max-width: $breakpoint-mobile) {
  .drawer__panel {
    width: 100vw;
    border-radius: 0;
    padding: var(--space-4);
  }

  .drawer__line {
    flex-direction: column;
    align-items: flex-start;
  }

  .drawer__line-actions {
    width: 100%;
    justify-content: space-between;
  }

  .drawer__footer {
    flex-direction: column;
    align-items: stretch;
  }

  .drawer__checkout {
    width: 100%;
  }
}
</style>
