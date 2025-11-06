<template>
  <section class="account">
    <header class="account__header">
      <div>
        <h1>Личный кабинет</h1>
        <p v-if="userProfile">Добро пожаловать, {{ userProfile.name || userProfile.email }}!</p>
        <p v-else>Загрузите информацию профиля, чтобы начать.</p>
      </div>
      <div class="account__actions">
        <button type="button" class="account__refresh" @click="refreshAll">
          Обновить данные
        </button>
        <button type="button" class="account__logout" @click="logout">
          Выйти
        </button>
      </div>
    </header>

    <nav class="account__tabs" role="tablist">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        :class="['account__tab', { 'account__tab--active': activeTab === tab.id }]"
        type="button"
        role="tab"
        :aria-selected="activeTab === tab.id"
        @click="activeTab = tab.id"
      >
        {{ tab.label }}
      </button>
    </nav>

    <section v-if="activeTab === 'profile'" class="account__section" role="tabpanel">
      <form class="account__form" @submit.prevent="submitProfile">
        <label>
          Имя
          <input v-model="profileDraft.name" type="text" autocomplete="name" />
        </label>
        <label>
          Email
          <input v-model="profileDraft.email" type="email" autocomplete="email" readonly />
        </label>
        <label>
          Телефон
          <input v-model="profileDraft.phone" type="tel" autocomplete="tel" placeholder="+7" />
        </label>
        <button type="submit" :disabled="userStore.isLoadingProfile">Сохранить</button>
      </form>
    </section>

    <section v-else-if="activeTab === 'addresses'" class="account__section" role="tabpanel">
      <div class="addresses__actions">
        <button type="button" @click="startAddressBinding">Добавить адрес через Ozon Банк</button>
        <button type="button" @click="userStore.fetchAddresses" :disabled="userStore.isLoadingAddresses">
          Обновить список
        </button>
      </div>
      <p class="addresses__hint">
        Все адреса хранятся на стороне Ozon Банка. После завершения процедуры привязки мы сохраняем
        только идентификатор и короткую подпись.
      </p>
      <ul class="addresses__list">
        <li v-for="address in userStore.addresses" :key="address.id" class="addresses__item">
          <div class="addresses__info">
            <div class="addresses__title">
              <strong>{{ address.label }}</strong>
              <span v-if="address.isDefault" class="addresses__badge">по умолчанию</span>
            </div>
            <p v-if="address.details?.addressLine" class="addresses__details">
              {{ address.details.addressLine }}
            </p>
            <p v-if="address.details?.receiver" class="addresses__details">
              Получатель: {{ address.details.receiver }}
            </p>
            <small v-if="address.lastSyncedAt">
              Синхронизирован: {{ formatDate(address.lastSyncedAt) }}
            </small>
          </div>
          <div class="addresses__buttons">
            <button
              type="button"
              class="addresses__btn"
              :disabled="address.isDefault"
              @click="setDefaultAddress(address.id)"
            >
              Сделать основным
            </button>
            <button type="button" class="addresses__btn addresses__btn--danger" @click="removeAddress(address.id)">
              Удалить
            </button>
          </div>
        </li>
      </ul>
      <div v-if="pendingAddressToken" class="addresses__pending">
        <p>Получен токен адреса. Нажмите, чтобы подтвердить:</p>
        <button type="button" @click="confirmAddress">Подтвердить адрес</button>
      </div>
    </section>

    <section v-else-if="activeTab === 'orders'" class="account__section" role="tabpanel">
      <div class="orders">
        <div class="orders__header">
          <h2>История заказов</h2>
          <button type="button" @click="userStore.fetchOrders" :disabled="userStore.isLoadingOrders">
            Обновить
          </button>
        </div>
        <ul class="orders__list">
          <li v-for="order in userStore.orderHistory" :key="order.id" class="orders__item">
            <div class="orders__meta">
              <strong>№ {{ order.number }}</strong>
              <span>{{ formatDate(order.createdAt) }}</span>
              <span class="orders__status" :data-status="order.status">
                {{ statusDictionary[order.status] }}
              </span>
            </div>
            <div class="orders__items">
              <div v-for="item in order.items" :key="`${order.id}-${item.productId}`" class="orders__item-line">
                <span class="orders__item-title">{{ item.title }}</span>
                <span class="orders__item-qty">×{{ item.quantity }}</span>
                <span class="orders__item-price">{{ formatMoney(item.price) }}</span>
                <span class="orders__item-total">
                  {{ formatMoney({ amount: item.price.amount * item.quantity, currency: item.price.currency }) }}
                </span>
              </div>
            </div>
            <div v-if="userStore.addresses.length" class="orders__shipping">
              <label :for="`order-address-${order.id}`">Адрес доставки</label>
              <select
                :id="`order-address-${order.id}`"
                :value="order.shippingAddressId ?? userStore.selectedAddressId ?? ''"
                @change="assignOrderAddress(order.id, $event)"
              >
                <option disabled value="">Выберите адрес</option>
                <option
                  v-for="address in userStore.addresses"
                  :key="`${order.id}-${address.id}`"
                  :value="address.id"
                >
                  {{ address.label }}
                </option>
              </select>
            </div>
            <div class="orders__footer">
              <span>{{ formatMoney(order.total) }}</span>
              <button type="button" @click="repeatOrder(order.id)">Повторить заказ</button>
            </div>
          </li>
        </ul>
        <p v-if="!userStore.orderHistory.length" class="orders__empty">
          Вы ещё не совершали заказов.
        </p>
      </div>
    </section>

    <section v-else class="account__section" role="tabpanel">
      <div class="loyalty">
        <h2>Система баллов</h2>
        <p>Баланс: <strong>{{ userStore.loyaltyPoints }}</strong> баллов</p>
        <form class="loyalty__redeem" @submit.prevent="redeemPoints">
          <label>Списать баллы</label>
          <div class="loyalty__redeem-controls">
            <input v-model.number="redeemAmount" type="number" min="1" placeholder="Количество" />
            <button type="submit">Списать</button>
          </div>
          <p v-if="pointsError" class="loyalty__error">{{ pointsError }}</p>
        </form>
        <div class="loyalty__history">
          <h3>История баллов</h3>
          <ul>
            <li v-for="entry in userStore.pointsHistory" :key="entry.id" :data-type="entry.type">
              <div>
                <strong>{{ entry.type === 'earn' ? '+' : '-' }}{{ entry.amount }}</strong>
                <span>{{ entry.description }}</span>
              </div>
              <time :datetime="entry.createdAt">{{ formatDate(entry.createdAt) }}</time>
            </li>
          </ul>
        </div>
        <p class="loyalty__hint">Начисление баллов и программ лояльности появится позже.</p>
      </div>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useUserStore } from '@/stores/user';
import { useAuthStore } from '@/stores/auth';
import type { UserProfile } from '@/types';

const userStore = useUserStore();
const authStore = useAuthStore();
const route = useRoute();
const router = useRouter();

const tabs = [
  { id: 'profile', label: 'Профиль' },
  { id: 'addresses', label: 'Адреса доставки' },
  { id: 'orders', label: 'История заказов' },
  { id: 'loyalty', label: 'Баллы' },
];

const activeTab = ref<'profile' | 'addresses' | 'orders' | 'loyalty'>('profile');
const profileDraft = reactive<UserProfile>({
  id: '',
  name: '',
  email: '',
  phone: '',
});

const pendingAddressToken = ref<string | null>(null);
const statusDictionary = {
  delivered: 'Доставлен',
  processing: 'В обработке',
  cancelled: 'Отменён',
} as const;
const redeemAmount = ref(0);
const pointsError = ref('');

const userProfile = computed(() => userStore.profile);

watch(
  () => userStore.profile,
  (profile) => {
    if (!profile) return;
    profileDraft.id = profile.id;
    profileDraft.name = profile.name;
    profileDraft.email = profile.email;
    profileDraft.phone = profile.phone ?? '';
  },
  { immediate: true },
);

const submitProfile = async () => {
  await userStore.updateProfile({
    name: profileDraft.name,
    phone: profileDraft.phone,
  });
};

const refreshAll = async () => {
  await Promise.all([
    userStore.fetchProfile(),
    userStore.fetchAddresses(),
    userStore.fetchOrders(),
  ]);
};

const startAddressBinding = async () => {
  try {
    const redirectUrl = await userStore.startAddressBinding();
    if (!redirectUrl) {
      throw new Error('Redirect URL not provided');
    }
    window.open(redirectUrl, '_blank', 'noopener');
  } catch (error) {
    console.error(error);
    alert('Не удалось инициировать привязку адреса. Попробуйте позже.');
  }
};

const confirmAddress = async () => {
  if (!pendingAddressToken.value) return;
  await userStore.addAddress({ addressToken: pendingAddressToken.value });
  pendingAddressToken.value = null;
  const { addressToken: _removed, ...rest } = route.query;
  await router.replace({ query: { ...rest } });
};

const repeatOrder = async (orderId: string) => {
  await userStore.repeatOrder({ orderId });
};

const setDefaultAddress = (addressId: string) => {
  userStore.setDefaultAddress(addressId);
};

const removeAddress = (addressId: string) => {
  userStore.removeAddress(addressId);
};

const assignOrderAddress = (orderId: string, event: Event) => {
  const target = event.target as HTMLSelectElement;
  userStore.assignAddressToOrder(orderId, target.value);
};

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

const formatMoney = ({ amount, currency }: { amount: number; currency: string }) =>
  amount.toLocaleString('ru-RU', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  });

const redeemPoints = () => {
  pointsError.value = '';
  if (!redeemAmount.value || redeemAmount.value <= 0) {
    pointsError.value = 'Введите количество баллов.';
    return;
  }
  try {
    userStore.redeemPoints(redeemAmount.value);
    redeemAmount.value = 0;
  } catch (error) {
    console.error(error);
    pointsError.value =
      error instanceof Error ? error.message : 'Не удалось списать баллы. Попробуйте позже.';
  }
};

const logout = async () => {
  await authStore.logout();
  router.push({ name: 'home' });
};

onMounted(() => {
  const { tab, addressToken } = route.query;
  if (typeof tab === 'string' && tabs.some((item) => item.id === tab)) {
    activeTab.value = tab as typeof activeTab.value;
  }
  if (typeof addressToken === 'string') {
    pendingAddressToken.value = addressToken;
  }
});

watch(
  () => route.query.tab,
  (next) => {
    if (typeof next === 'string' && tabs.some((item) => item.id === next)) {
      activeTab.value = next as typeof activeTab.value;
    }
  },
);

watch(activeTab, (next) => {
  router.replace({ query: { ...route.query, tab: next } }).catch(() => undefined);
});
</script>

<style scoped lang="scss">
.account {
  display: grid;
  gap: var(--space-6);
  padding: var(--space-6) 0 var(--space-8);
}

.account__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-3);

  h1 {
    margin: 0;
  }
}

.account__actions {
  display: flex;
  gap: var(--space-2);
}

.account__refresh,
.account__logout {
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-4);
  background: var(--surface);
  font-weight: 600;
}

.account__logout {
  border-color: rgba(214, 69, 80, 0.4);
  color: var(--danger);
}

.account__tabs {
  display: flex;
  gap: var(--space-2);
  background: rgba(0, 0, 0, 0.04);
  border-radius: var(--radius-lg);
  padding: var(--space-1);
}

.account__tab {
  border: none;
  background: transparent;
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  font-weight: 600;
  color: var(--text-secondary);

  &--active {
    background: var(--accent);
    color: #fff;
  }
}

.account__section {
  background: var(--surface);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  box-shadow: var(--shadow-sm);
}

.account__form {
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
  }
}

.addresses__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  margin-bottom: var(--space-3);

  button {
    border-radius: var(--radius-md);
    border: none;
    padding: var(--space-2) var(--space-4);
    background: var(--accent);
    color: #fff;

    &:last-child {
      background: rgba(0, 0, 0, 0.06);
      color: var(--text-primary);
    }
  }
}

.addresses__hint {
  color: var(--text-secondary);
  margin-bottom: var(--space-4);
}

.addresses__list {
  display: grid;
  gap: var(--space-3);
}

.addresses__item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--space-4);
  padding: var(--space-3);
  border-radius: var(--radius-md);
  background: rgba(0, 0, 0, 0.04);

  small {
    display: block;
    color: var(--text-secondary);
    font-size: var(--fz-caption);
  }
}

.addresses__info {
  display: grid;
  gap: var(--space-2);
}

.addresses__title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.addresses__badge {
  background: rgba(31, 157, 111, 0.12);
  color: var(--success);
  padding: 0 var(--space-2);
  border-radius: 999px;
  font-size: var(--fz-caption);
  text-transform: uppercase;
}

.addresses__details {
  margin: 0;
  color: var(--text-secondary);
  font-size: var(--fz-caption);
}

.addresses__buttons {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.addresses__btn {
  border: none;
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-4);
  background: rgba(0, 0, 0, 0.06);
  font-weight: 600;

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.addresses__btn--danger {
  background: rgba(214, 69, 80, 0.12);
  color: var(--danger);
}

.addresses__pending {
  margin-top: var(--space-4);
  padding: var(--space-3);
  border-radius: var(--radius-md);
  background: rgba(31, 157, 111, 0.1);
  display: grid;
  gap: var(--space-2);

  button {
    justify-self: flex-start;
    border: none;
    border-radius: var(--radius-md);
    padding: var(--space-2) var(--space-4);
    background: var(--success);
    color: #fff;
  }
}

.orders {
  display: grid;
  gap: var(--space-4);
}

.orders__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.orders__list {
  display: grid;
  gap: var(--space-3);
}

.orders__item {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-4);
  border-radius: var(--radius-md);
  background: rgba(0, 0, 0, 0.04);
}

.orders__meta {
  display: flex;
  gap: var(--space-3);
  flex-wrap: wrap;
  align-items: center;
}

.orders__status {
  padding: var(--space-1) var(--space-3);
  border-radius: 999px;
  font-size: var(--fz-caption);
  background: rgba(0, 0, 0, 0.06);

  &[data-status='delivered'] {
    background: rgba(31, 157, 111, 0.15);
    color: var(--success);
  }
  &[data-status='cancelled'] {
    background: rgba(214, 69, 80, 0.15);
    color: var(--danger);
  }
}

.orders__footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-3);

  button {
    border: none;
    border-radius: var(--radius-md);
    background: var(--accent);
    color: #fff;
    padding: var(--space-2) var(--space-4);
  }
}

.orders__items {
  display: grid;
  gap: var(--space-2);
}

.orders__item-line {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto auto;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--fz-caption);
}

.orders__item-title {
  font-weight: 600;
}

.orders__item-qty {
  text-align: right;
  color: var(--text-secondary);
}

.orders__item-price,
.orders__item-total {
  text-align: right;
}

.orders__shipping {
  display: grid;
  gap: var(--space-2);

  label {
    font-size: var(--fz-caption);
    color: var(--text-secondary);
  }

  select {
    border-radius: var(--radius-md);
    border: 1px solid var(--border);
    padding: var(--space-2) var(--space-3);
  }
}

.orders__empty {
  color: var(--text-secondary);
}

.loyalty {
  display: grid;
  gap: var(--space-2);
}

.loyalty__redeem {
  display: grid;
  gap: var(--space-2);
}

.loyalty__redeem-controls {
  display: flex;
  gap: var(--space-2);
  align-items: center;

  input {
    width: 140px;
    border-radius: var(--radius-md);
    border: 1px solid var(--border);
    padding: var(--space-2) var(--space-3);
  }

  button {
    border: none;
    border-radius: var(--radius-md);
    padding: var(--space-2) var(--space-4);
    background: var(--accent);
    color: #fff;
  }
}

.loyalty__error {
  margin: 0;
  color: var(--danger);
  font-size: var(--fz-caption);
}

.loyalty__history {
  display: grid;
  gap: var(--space-2);

  ul {
    display: grid;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: rgba(0, 0, 0, 0.04);
    padding: var(--space-2);
    border-radius: var(--radius-md);

    &[data-type='earn'] strong {
      color: var(--success);
    }

    &[data-type='spend'] strong {
      color: var(--danger);
    }

    span {
      display: block;
      font-size: var(--fz-caption);
      color: var(--text-secondary);
    }

    time {
      font-size: var(--fz-caption);
      color: var(--text-secondary);
    }
  }
}

.loyalty__hint {
  color: var(--text-secondary);
}
</style>
