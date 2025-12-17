<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="checkout" role="dialog" aria-modal="true">
        <div class="checkout__backdrop" @click="handleClose" />
        <div class="checkout__panel" ref="panelRef" tabindex="-1">
          <header class="checkout__header">
            <h2>Оформление заказа</h2>
            <button type="button" @click="handleClose" aria-label="Закрыть">✕</button>
          </header>

          <section class="checkout__section">
            <h3>Служба доставки</h3>
            <div class="checkout__choices">
              <label v-for="option in providerOptions" :key="option.id" class="checkout__chip">
                <input
                  name="delivery-provider"
                  type="radio"
                  :value="option.id"
                  :checked="deliveryDraft.provider === option.id"
                  @change="onProviderChange(option.id)"
                />
                <span>{{ option.label }}</span>
              </label>
            </div>
          </section>

          <section class="checkout__section">
            <h3>Способ доставки</h3>
            <div class="checkout__choices">
              <label v-for="option in typeOptions" :key="option.id" class="checkout__chip">
                <input
                  name="delivery-type"
                  type="radio"
                  :value="option.id"
                  :checked="deliveryDraft.type === option.id"
                  @change="onTypeChange(option.id)"
                />
                <span>{{ option.label }}</span>
              </label>
            </div>
          </section>

          <section v-if="deliveryDraft.type === 'pvz'" class="checkout__section">
            <h3>Пункты выдачи</h3>
            <div class="checkout__pvz-search">
              <input
                :value="deliveryDraft.pvzSearch.city"
                type="text"
                placeholder="Город (обязательно)"
                aria-label="Город для поиска ПВЗ"
                @input="onPvzCityChange"
              />
              <input
                :value="deliveryDraft.pvzSearch.query"
                type="text"
                placeholder="Доп. поиск (улица/название)"
                aria-label="Поиск ПВЗ"
                @input="onPvzQueryChange"
              />
              <button type="button" @click="handleSearchPvz" :disabled="pvzLoading">
                {{ pvzLoading ? 'Поиск...' : 'Найти ПВЗ' }}
              </button>
            </div>
            <p class="checkout__hint">Вес корзины: {{ cartStore.totalWeight || '—' }} кг</p>
            <p v-if="pvzError" class="checkout__error">{{ pvzError }}</p>
            <div class="checkout__points">
              <button
                v-for="point in deliveryDraft.pvzResults"
                :key="point.id"
                type="button"
                :class="['checkout__point', { 'checkout__point--active': point.id === deliveryDraft.pickup_point_id }]"
                @click="selectPickup(point)"
              >
                <strong>{{ point.name }}</strong>
                <span>{{ point.address }}</span>
              </button>
            </div>
            <p v-if="!deliveryDraft.pvzResults.length && !pvzLoading" class="checkout__hint">
              Сначала выполните поиск ПВЗ по городу.
            </p>
          </section>

          <section v-else class="checkout__section checkout__address">
            <h3>Адрес доставки до двери</h3>
            <div class="checkout__grid">
              <label>
                Регион/область*
                <input :value="deliveryDraft.address.region" type="text" @input="onAddressChange('region', $event)" />
              </label>
              <label>
                Город*
                <input :value="deliveryDraft.address.city" type="text" @input="onAddressChange('city', $event)" />
              </label>
              <label>
                Индекс*
                <input :value="deliveryDraft.address.postal_code" type="text" @input="onAddressChange('postal_code', $event)" />
              </label>
              <label>
                Улица*
                <input :value="deliveryDraft.address.street" type="text" @input="onAddressChange('street', $event)" />
              </label>
              <label>
                Дом*
                <input :value="deliveryDraft.address.house" type="text" @input="onAddressChange('house', $event)" />
              </label>
              <label>
                Квартира (опционально)
                <input :value="deliveryDraft.address.flat" type="text" @input="onAddressChange('flat', $event)" />
              </label>
            </div>
          </section>

          <section class="checkout__section checkout__recipient">
            <h3>Получатель</h3>
            <div class="checkout__grid">
              <label>
                ФИО*
                <input
                  :value="deliveryDraft.recipient.full_name"
                  type="text"
                  required
                  @input="onRecipientChange('full_name', $event)"
                />
              </label>
              <label>
                Телефон*
                <input
                  :value="deliveryDraft.recipient.phone"
                  type="tel"
                  required
                  @input="onRecipientChange('phone', $event)"
                />
              </label>
              <label>
                Email
                <input
                  :value="deliveryDraft.recipient.email"
                  type="email"
                  @input="onRecipientChange('email', $event)"
                />
              </label>
              <label class="checkout__comment">
                Комментарий к доставке
                <textarea :value="deliveryDraft.comment" rows="2" @input="onCommentChange" />
              </label>
            </div>
            <p class="checkout__hint">
              ФИО — минимум два слова, телефон — не менее 10 цифр. Цена доставки не рассчитывается, пока данные
              некорректны.
            </p>
          </section>

          <section class="checkout__section checkout__summary">
            <div class="checkout__summary-info">
              <div class="checkout__quote">
                <div>
                  <span>Стоимость доставки:</span>
                  <strong>{{ formattedDeliveryPrice }}</strong>
                </div>
                <small>Срок: {{ formattedEta }}</small>
                <small>Вес: {{ cartStore.totalWeight || '—' }} кг</small>
              </div>
              <div class="checkout__summary-actions">
                <button
                  type="button"
                  class="checkout__calc"
                  :disabled="!canCalculate || calcLoading"
                  @click="handleCalculate"
                >
                  {{ calcLoading ? 'Расчёт...' : 'Рассчитать доставку' }}
                </button>
                <label :class="['checkout__bonus', { 'checkout__bonus--disabled': !canUseBonuses }]">
                  <input v-model="useBonuses" type="checkbox" :disabled="!canUseBonuses" />
                  <div>
                    <span>Использовать бонусы</span>
                    <small>Доступно: {{ formattedBonusBalance }}</small>
                  </div>
                </label>
              </div>
            </div>

            <p v-if="calcError" class="checkout__error">{{ calcError }}</p>

            <div class="checkout__totals">
              <div>
                <span>Товары:</span>
                <strong>{{ formattedGoodsTotal }}</strong>
              </div>
              <div>
                <span>Доставка:</span>
                <strong>{{ formattedDeliveryPrice }}</strong>
              </div>
              <div>
                <span>Итого к оплате:</span>
                <strong>{{ formattedTotalWithDelivery }}</strong>
              </div>
            </div>

            <button type="button" class="checkout__pay" :disabled="!canSubmit" @click="handlePay">
              Оформить заказ
            </button>
          </section>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useCartStore } from '@/stores/cart';
import { useUserStore } from '@/stores/user';
import { useCheckoutStore } from '@/stores/checkout';
import { searchPvz, calculateDelivery } from '@/services/deliveryService';
import type { DeliveryServiceId } from '@/types/pickup';
import type { DeliveryType, DeliveryPvz } from '@/types/delivery';

const props = defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  (event: 'close'): void;
  (
    event: 'submit',
    payload: { delivery: Record<string, unknown>; deliveryPrice: number; useBonuses: boolean },
  ): void;
}>();

const providerOptions: Array<{ id: DeliveryServiceId; label: string }> = [
  { id: 'cdek', label: 'СДЭК' },
  { id: 'ruspost', label: 'Почта России' },
];

const typeOptions: Array<{ id: DeliveryType; label: string }> = [
  { id: 'pvz', label: 'ПВЗ' },
  { id: 'door', label: 'До двери' },
];

const panelRef = ref<HTMLDivElement | null>(null);
const useBonuses = ref(false);

const cartStore = useCartStore();
const userStore = useUserStore();
const checkoutStore = useCheckoutStore();
const { deliveryDraft, deliveryQuote, pvzLoading, pvzError, calcLoading, calcError } =
  storeToRefs(checkoutStore);

const bonusBalance = computed(() => userStore.bonusBalance);
const formattedBonusBalance = computed(() =>
  bonusBalance.value.toLocaleString('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }),
);
const canUseBonuses = computed(() => bonusBalance.value > 0);

const weightIsReady = computed(() => cartStore.totalWeight > 0);
const recipientValid = computed(() => {
  const words = deliveryDraft.value.recipient.full_name.trim().split(/\s+/).filter(Boolean).length;
  const digits = deliveryDraft.value.recipient.phone.replace(/\D/g, '');
  return words >= 2 && digits.length >= 10;
});
const addressValid = computed(() => {
  const addr = deliveryDraft.value.address;
  return Boolean(addr.region && addr.city && addr.postal_code && addr.street && addr.house);
});
const pvzReady = computed(() => Boolean(deliveryDraft.value.pickup_point_id));
const canCalculate = computed(() => {
  if (!weightIsReady.value || !recipientValid.value) return false;
  if (deliveryDraft.value.type === 'pvz') return pvzReady.value;
  return addressValid.value;
});
const deliveryPrice = computed(() => deliveryQuote.value.delivery_price);
const canSubmit = computed(
  () => deliveryPrice.value !== null && canCalculate.value && !calcLoading.value,
);

const formattedDeliveryPrice = computed(() => {
  if (deliveryPrice.value === null) return 'не рассчитана';
  return formatCurrency(
    deliveryPrice.value,
    deliveryQuote.value.delivery_currency || cartStore.currency,
  );
});
const formattedEta = computed(() => deliveryQuote.value.delivery_eta || '—');
const formattedGoodsTotal = computed(() => formatCurrency(cartStore.totalAmount, cartStore.currency));
const formattedTotalWithDelivery = computed(() => {
  const delivery = deliveryPrice.value ?? 0;
  return formatCurrency(cartStore.totalAmount + delivery, cartStore.currency);
});

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      lockBodyScroll(true);
      requestAnimationFrame(() => panelRef.value?.focus());
    } else {
      lockBodyScroll(false);
    }
  },
);

watch(bonusBalance, (value) => {
  if (value <= 0) {
    useBonuses.value = false;
  }
});

watch(
  () => cartStore.totalWeight,
  () => {
    checkoutStore.resetQuote();
  },
);

onMounted(() => {
  if (props.open) {
    lockBodyScroll(true);
  }
});

onUnmounted(() => {
  lockBodyScroll(false);
});

function lockBodyScroll(lock: boolean) {
  document.body.style.overflow = lock ? 'hidden' : '';
}

function onProviderChange(id: DeliveryServiceId) {
  checkoutStore.setProvider(id);
}

function onTypeChange(id: DeliveryType) {
  checkoutStore.setType(id);
}

function onPvzCityChange(event: Event) {
  checkoutStore.setPvzSearchCity((event.target as HTMLInputElement).value);
}

function onPvzQueryChange(event: Event) {
  checkoutStore.setPvzSearchQuery((event.target as HTMLInputElement).value);
}

function onAddressChange(field: keyof typeof deliveryDraft.value.address, event: Event) {
  checkoutStore.updateAddressField(field, (event.target as HTMLInputElement).value);
}

function onRecipientChange(field: keyof typeof deliveryDraft.value.recipient, event: Event) {
  const value = (event.target as HTMLInputElement).value;
  const normalized = field === 'phone' ? value.replace(/\D/g, '') : value;
  checkoutStore.updateRecipientField(field, normalized);
}

function onCommentChange(event: Event) {
  checkoutStore.setComment((event.target as HTMLTextAreaElement).value);
}

function selectPickup(point: DeliveryPvz) {
  checkoutStore.selectPvz(point);
}

async function handleSearchPvz() {
  checkoutStore.setPvzError('');
  if (!deliveryDraft.value.pvzSearch.city && !deliveryDraft.value.pvzSearch.query) {
    checkoutStore.setPvzError('Укажите город или строку поиска.');
    return;
  }
  checkoutStore.setPvzLoading(true);
  checkoutStore.resetQuote();
  try {
    const { points } = await searchPvz(
      deliveryDraft.value.provider,
      deliveryDraft.value.pvzSearch.city,
      deliveryDraft.value.pvzSearch.query,
    );
    const list = (points ?? []) as DeliveryPvz[];
    checkoutStore.setPvzResults(list);
    checkoutStore.selectPvz(list[0] ?? null);
  } catch (error) {
    console.error('[Checkout] PVZ search failed', error);
    checkoutStore.setPvzResults([]);
    checkoutStore.selectPvz(null);
    checkoutStore.setPvzError(
      error instanceof Error ? error.message : 'Не удалось найти пункты выдачи, попробуйте позже.',
    );
  } finally {
    checkoutStore.setPvzLoading(false);
  }
}

async function handleCalculate() {
  checkoutStore.setCalcError('');
  checkoutStore.resetQuote();
  if (!canCalculate.value) return;
  checkoutStore.setCalcLoading(true);
  try {
    const payload = {
      provider: deliveryDraft.value.provider,
      type: deliveryDraft.value.type,
      total_weight: cartStore.totalWeight,
      pickup_point_id:
        deliveryDraft.value.type === 'pvz' ? deliveryDraft.value.pickup_point_id : undefined,
      address: deliveryDraft.value.type === 'door' ? deliveryDraft.value.address : undefined,
      provider_metadata: Object.keys(deliveryDraft.value.provider_metadata ?? {}).length
        ? deliveryDraft.value.provider_metadata
        : undefined,
    };
    const quote = await calculateDelivery(payload);
    checkoutStore.setDeliveryQuote(quote);
  } catch (error) {
    console.error('[Checkout] delivery calculate failed', error);
    checkoutStore.setCalcError(
      error instanceof Error ? error.message : 'Не удалось рассчитать доставку, попробуйте позже.',
    );
  } finally {
    checkoutStore.setCalcLoading(false);
  }
}

const handleClose = () => {
  emit('close');
};

const handlePay = () => {
  if (deliveryPrice.value === null || !canSubmit.value) return;
  const mergedProviderMetadata = {
    ...(deliveryDraft.value.provider_metadata ?? {}),
    ...((deliveryQuote.value.provider_metadata ?? {}) as Record<string, unknown>),
  };
  const deliveryPayload = {
    provider: deliveryDraft.value.provider,
    type: deliveryDraft.value.type,
    pickup_point_id: deliveryDraft.value.type === 'pvz' ? deliveryDraft.value.pickup_point_id : undefined,
    pickup_point_address:
      deliveryDraft.value.type === 'pvz' ? deliveryDraft.value.pickup_point_address : undefined,
    address: deliveryDraft.value.type === 'door' ? deliveryDraft.value.address : undefined,
    recipient: deliveryDraft.value.recipient,
    delivery_price: deliveryPrice.value,
    delivery_currency: deliveryQuote.value.delivery_currency,
    delivery_eta: deliveryQuote.value.delivery_eta,
    tariff_code: deliveryQuote.value.tariff_code,
    provider_metadata: Object.keys(mergedProviderMetadata).length ? mergedProviderMetadata : undefined,
    comment: deliveryDraft.value.comment || undefined,
  };

  emit('submit', {
    delivery: deliveryPayload,
    deliveryPrice: deliveryPrice.value,
    useBonuses: useBonuses.value,
  });
  emit('close');
};

function formatCurrency(amount: number, currency: string) {
  return amount.toLocaleString('ru-RU', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  });
}
</script>

<style scoped lang="scss">
.checkout {
  position: fixed;
  inset: 0;
  z-index: 400;
  display: flex;
  align-items: center;
  justify-content: center;
}

.checkout__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
}

.checkout__panel {
  position: relative;
  width: min(960px, 96vw);
  background: var(--surface);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  box-shadow: var(--shadow-lg);
  display: grid;
  gap: var(--space-5);
  max-height: 90vh;
  overflow-y: auto;
  outline: none;
}

.checkout__header {
  display: flex;
  justify-content: space-between;
  align-items: center;

  button {
    border: none;
    background: transparent;
    font-size: 20px;
  }
}

.checkout__section {
  display: grid;
  gap: var(--space-3);
}

.checkout__choices {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.checkout__chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  cursor: pointer;

  input {
    accent-color: var(--accent);
  }
}

.checkout__points {
  display: grid;
  gap: var(--space-2);
  max-height: 280px;
  overflow-y: auto;
}

.checkout__point {
  display: grid;
  gap: var(--space-1);
  text-align: left;
  border-radius: var(--radius-md);
  border: 1px solid transparent;
  padding: var(--space-2);
  background: rgba(0, 0, 0, 0.04);
  cursor: pointer;

  strong {
    font-size: var(--fz-body);
  }

  span {
    font-size: var(--fz-caption);
    color: var(--text-secondary);
  }

  &--active {
    border-color: var(--accent);
    background: rgba(118, 194, 240, 0.2);
  }
}

.checkout__pvz-search {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: var(--space-2);

  input {
    border-radius: var(--radius-md);
    border: 1px solid var(--border);
    padding: var(--space-2);
  }

  button {
    border-radius: var(--radius-md);
    border: none;
    padding: var(--space-2) var(--space-3);
    background: var(--accent);
    color: #fff;
    font-weight: 600;
  }
}

.checkout__grid {
  display: grid;
  gap: var(--space-3);
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));

  input,
  textarea {
    width: 100%;
    border-radius: var(--radius-md);
    border: 1px solid var(--border);
    padding: var(--space-2);
  }

  textarea {
    resize: vertical;
  }
}

.checkout__summary {
  display: grid;
  gap: var(--space-3);
}

.checkout__pay {
  border: none;
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-5);
  background: var(--accent);
  color: #fff;
  font-weight: 600;

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.checkout__hint {
  font-size: var(--fz-caption);
  color: var(--text-secondary);
}

.checkout__summary-info {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  flex-wrap: wrap;
}

.checkout__bonus {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: var(--space-2);
  align-items: center;
  font-weight: 600;
  cursor: pointer;

  input {
    width: 18px;
    height: 18px;
    margin: 0;
    accent-color: var(--accent);
  }

  span {
    display: block;
  }

  small {
    display: block;
    font-weight: 400;
    color: var(--text-secondary);
    font-size: var(--fz-caption);
  }
}

.checkout__bonus--disabled {
  opacity: 0.5;
  user-select: none;
}

.checkout__calc {
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-3);
  background: #f5f7fb;
  font-weight: 600;

  &:disabled {
    opacity: 0.6;
  }
}

.checkout__quote {
  display: grid;
  gap: var(--space-1);
}

.checkout__error {
  color: var(--danger);
  font-size: var(--fz-caption);
}

@media (max-width: 700px) {
  .checkout__panel {
    padding: var(--space-5);
  }

  .checkout__summary-info {
    flex-direction: column;
    align-items: stretch;
  }

  .checkout__pay {
    width: 100%;
  }

  .checkout__pvz-search {
    grid-template-columns: 1fr;
  }
}

.checkout__totals {
  display: grid;
  gap: var(--space-2);
}

.checkout__totals > div {
  display: flex;
  justify-content: space-between;
  gap: var(--space-2);
}

.checkout__comment textarea {
  min-height: 68px;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
  transform: scale(0.96);
}

.modal-enter-active,
.modal-leave-active {
  transition: all 160ms ease;
}
</style>
