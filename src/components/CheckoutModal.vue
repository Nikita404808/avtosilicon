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
            <select v-model="selectedService" @change="onServiceChange">
              <option v-for="service in services" :key="service.id" :value="service.id">
                {{ service.label }}
              </option>
            </select>
          </section>

          <section class="checkout__section checkout__section--map">
            <h3>Пункты выдачи</h3>
            <div class="checkout__map-wrapper">
              <CheckoutMap
                :provider="selectedService"
                :points="pickupPoints"
                :selected-point-id="selectedPointId"
                @update:bounds="onBoundsChange"
                @select="onPointSelect"
                @ready="loadPickupPoints"
              />
              <div class="checkout__points">
                <button
                  v-for="point in pickupPoints"
                  :key="point.id"
                  type="button"
                  :class="['checkout__point', { 'checkout__point--active': point.id === selectedPointId }]"
                  @click="selectPoint(point)"
                >
                  <strong>{{ point.name }}</strong>
                  <span>{{ point.address }}</span>
                </button>
              </div>
            </div>
            <p v-if="isLoading" class="checkout__hint">Загружаем пункты выдачи…</p>
            <p v-else-if="!pickupPoints.length" class="checkout__hint">
              В выбранной области пока нет пунктов выдачи.
            </p>
          </section>

          <section class="checkout__section checkout__summary">
            <div class="checkout__summary-info">
              <div>
                <span>Стоимость доставки:</span>
                <strong>—</strong>
              </div>
              <label :class="['checkout__bonus', { 'checkout__bonus--disabled': !canUseBonuses }]">
                <input v-model="useBonuses" type="checkbox" :disabled="!canUseBonuses" />
                <div>
                  <span>Использовать бонусы</span>
                  <small>Доступно: {{ formattedBonusBalance }}</small>
                </div>
              </label>
            </div>
            <button type="button" class="checkout__pay" :disabled="!selectedPointId" @click="handlePay">
              Оплатить
            </button>
          </section>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';

const props = defineProps<{
  open: boolean;
}>();

import CheckoutMap from '@/components/checkout/PickupMap.vue';
import { getPickupPoints } from '@/services/pickupService';
import type { DeliveryServiceId, PickupPoint, MapBounds } from '@/types/pickup';
import { useUserStore } from '@/stores/user';

const emit = defineEmits<{
  (event: 'close'): void;
  (
    event: 'submit',
    payload: { service: DeliveryServiceId; point: PickupPoint | null; useBonuses: boolean },
  ): void;
}>();

const services: Array<{ id: DeliveryServiceId; label: string }> = [
  { id: 'pochta', label: 'Почта России' },
  { id: 'cdek', label: 'СДЭК' },
  { id: 'yandex', label: 'Яндекс Доставка' },
];

const selectedService = ref<DeliveryServiceId>('pochta');
const selectedPointId = ref<string | null>(null);
const pickupPoints = ref<PickupPoint[]>([]);
const isLoading = ref(false);
const mapBounds = ref<MapBounds | null>(null);
const panelRef = ref<HTMLDivElement | null>(null);
const useBonuses = ref(false);
const userStore = useUserStore();
const bonusBalance = computed(() => userStore.bonusBalance);
const formattedBonusBalance = computed(() =>
  bonusBalance.value.toLocaleString('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }),
);
const canUseBonuses = computed(() => bonusBalance.value > 0);

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      useBonuses.value = false;
      lockBodyScroll(true);
      requestAnimationFrame(() => panelRef.value?.focus());
      loadPickupPoints();
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

onMounted(() => {
  if (props.open) {
    useBonuses.value = false;
    lockBodyScroll(true);
    loadPickupPoints();
  }
});

onUnmounted(() => {
  lockBodyScroll(false);
});

function lockBodyScroll(lock: boolean) {
  document.body.style.overflow = lock ? 'hidden' : '';
}

async function loadPickupPoints() {
  isLoading.value = true;
  const previousSelection = selectedPointId.value;
  try {
    const points = await getPickupPoints(selectedService.value, mapBounds.value ?? defaultBounds);
    pickupPoints.value = points;
    if (previousSelection && points.some((point) => point.id === previousSelection)) {
      selectedPointId.value = previousSelection;
    } else {
      selectedPointId.value = points[0]?.id ?? null;
    }
  } catch (error) {
    console.error('[CheckoutModal] failed to load points', error);
    pickupPoints.value = [];
    selectedPointId.value = null;
  } finally {
    isLoading.value = false;
  }
}
const defaultBounds: MapBounds = {
  southWest: { lat: 40, lng: 19 },
  northEast: { lat: 70, lng: 180 },
};

const onServiceChange = () => {
  loadPickupPoints();
};

const handleClose = () => {
  emit('close');
};

const handlePay = () => {
  const point = pickupPoints.value.find((item) => item.id === selectedPointId.value) ?? null;
  emit('submit', { service: selectedService.value, point, useBonuses: useBonuses.value });
  emit('close');
};

const onBoundsChange = (bounds: MapBounds) => {
  mapBounds.value = bounds;
  loadPickupPoints();
};

const onPointSelect = (pointId: string) => {
  selectedPointId.value = pointId;
};

const selectPoint = (point: PickupPoint) => {
  onPointSelect(point.id);
};
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

  select {
    border-radius: var(--radius-md);
    border: 1px solid var(--border);
    padding: var(--space-2) var(--space-3);
  }
}

.checkout__section--map {
  gap: var(--space-3);
}

.checkout__map-wrapper {
  display: grid;
  grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
  gap: var(--space-4);

  @media (max-width: $breakpoint-tablet) {
    grid-template-columns: 1fr;
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

.checkout__summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-3);

  > div {
    display: grid;
    gap: var(--space-2);
  }
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
  display: grid;
  gap: var(--space-2);
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
  cursor: not-allowed;
  opacity: 0.7;
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
