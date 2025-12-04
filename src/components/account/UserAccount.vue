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
      <div v-if="authStore.needsEmailVerification" class="account__notice">
        <div>
          <h3>Подтвердите email</h3>
          <p>Мы отправим код подтверждения на {{ userProfile?.email }}.</p>
        </div>
        <div class="account__notice-actions">
          <button type="button" @click="sendVerifyCode" :disabled="isSendingVerify">
            {{ isSendingVerify ? 'Отправляем…' : 'Выслать код' }}
          </button>
          <input v-model="verifyToken" type="text" placeholder="Код из письма" />
          <button type="button" class="account__notice-confirm" @click="confirmVerify" :disabled="isVerifyingEmail">
            Подтвердить
          </button>
        </div>
        <p v-if="verifyMessage" class="account__notice-hint">{{ verifyMessage }}</p>
      </div>
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
        <div v-if="bonusBalance !== null" class="account__balance">
          <span>Бонусный баланс</span>
          <strong>{{ formattedBonusBalance }}</strong>
        </div>
        <p v-if="profileError" class="account__form-error">{{ profileError }}</p>
        <button
          type="submit"
          :disabled="userStore.isLoadingProfile || isSavingProfile || !isProfileDirty"
          :class="['account__save', { 'account__save--dirty': isProfileDirty }]"
        >
          {{ isSavingProfile ? 'Сохраняем…' : 'Сохранить' }}
        </button>
      </form>
    </section>

    <section v-else-if="activeTab === 'orders'" class="account__section" role="tabpanel">
      <div class="orders">
        <div class="orders__header">
          <h2>История заказов</h2>
          <button type="button" class="orders__refresh" @click="userStore.fetchOrders" :disabled="userStore.isLoadingOrders">
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
            <div v-if="order.bonus" class="orders__bonus">
              <span>Списано бонусов: <strong>{{ order.bonus.spent }}</strong></span>
              <span>Начислено: <strong>{{ order.bonus.earned }}</strong></span>
              <span>
                К оплате: <strong>{{ formatMoney({ amount: order.bonus.payable, currency: order.total.currency }) }}</strong>
              </span>
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
  { id: 'orders', label: 'История заказов' },
];

const activeTab = ref<'profile' | 'orders'>('profile');
const profileDraft = reactive<UserProfile>({
  id: '',
  name: '',
  email: '',
  phone: '',
});
const baselineProfile = reactive<{ name: string; phone: string }>({ name: '', phone: '' });
const profileError = ref('');
const isSavingProfile = ref(false);

const statusDictionary = {
  delivered: 'Доставлен',
  processing: 'В обработке',
  cancelled: 'Отменён',
} as const;

const userProfile = computed(() => userStore.profile);
const bonusBalance = computed(() => userStore.bonusBalance ?? null);
const formattedBonusBalance = computed(() =>
  bonusBalance.value !== null
    ? bonusBalance.value.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 })
    : '',
);
const isProfileDirty = computed(
  () =>
    profileDraft.name !== baselineProfile.name ||
    profileDraft.phone !== baselineProfile.phone,
);

watch(
  () => userStore.profile,
  (profile) => {
    if (!profile) return;
    profileDraft.id = profile.id;
    profileDraft.name = profile.name;
    profileDraft.email = profile.email;
    profileDraft.phone = profile.phone ?? '';
    baselineProfile.name = profileDraft.name;
    baselineProfile.phone = profileDraft.phone ?? '';
  },
  { immediate: true },
);

const submitProfile = async () => {
  profileError.value = '';
  const trimmedName = profileDraft.name.trim();
  if (!trimmedName) {
    profileError.value = 'Введите имя.';
    return;
  }

  isSavingProfile.value = true;
  try {
    await userStore.updateName(trimmedName);
    await userStore.updateProfile({ phone: profileDraft.phone });
    profileDraft.name = trimmedName;
    baselineProfile.name = trimmedName;
    baselineProfile.phone = profileDraft.phone ?? '';
    window.alert('Сохранено');
  } catch (error) {
    console.error('[Profile] failed to update', error);
    profileError.value = error instanceof Error ? error.message : 'Не удалось сохранить.';
  } finally {
    isSavingProfile.value = false;
  }
};

const refreshAll = async () => {
  await Promise.all([
    userStore.fetchProfile(),
    userStore.fetchOrders(),
  ]);
};

const repeatOrder = async (orderId: string) => {
  await userStore.repeatOrder({ orderId });
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

const logout = async () => {
  await authStore.logout();
  router.push({ name: 'home' });
};

const verifyToken = ref('');
const isSendingVerify = ref(false);
const isVerifyingEmail = ref(false);
const verifyMessage = ref('');

const sendVerifyCode = async () => {
  isSendingVerify.value = true;
  verifyMessage.value = '';
  try {
    await authStore.sendVerifyCode();
    verifyMessage.value = 'Код подтверждения отправлен на ваш email.';
  } catch (error) {
    console.error('[VerifyEmail] send code failed', error);
    verifyMessage.value = error instanceof Error ? error.message : 'Не удалось отправить код.';
  } finally {
    isSendingVerify.value = false;
  }
};

const confirmVerify = async () => {
  if (!verifyToken.value.trim()) {
    verifyMessage.value = 'Введите код из письма.';
    return;
  }
  isVerifyingEmail.value = true;
  verifyMessage.value = '';
  try {
    await authStore.verifyEmail(verifyToken.value.trim());
    verifyToken.value = '';
    verifyMessage.value = 'Email подтверждён!';
    userStore.setProfileFromAuth({
      id: userProfile.value?.id ?? '',
      email: userProfile.value?.email ?? '',
      name: userProfile.value?.name ?? null,
      emailVerified: true,
    });
    authStore.patchUser({ emailVerified: true });
  } catch (error) {
    console.error('[VerifyEmail] failed', error);
    verifyMessage.value = error instanceof Error ? error.message : 'Код неверен или устарел.';
  } finally {
    isVerifyingEmail.value = false;
  }
};

onMounted(() => {
  const { tab } = route.query;
  if (typeof tab === 'string' && tabs.some((item) => item.id === tab)) {
    activeTab.value = tab as typeof activeTab.value;
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

.account__notice {
  border: 1px dashed var(--accent);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  display: grid;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
  background: rgba(255, 196, 0, 0.08);
}

.account__notice-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);

  input {
    flex: 1;
    min-width: 160px;
    border-radius: var(--radius-md);
    border: 1px solid var(--border);
    padding: var(--space-2) var(--space-3);
  }

  button {
    border-radius: var(--radius-md);
    border: none;
    background: var(--accent);
    color: #fff;
    padding: var(--space-2) var(--space-4);
    font-weight: 600;

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  }
}

.account__notice-hint {
  margin: 0;
  font-size: var(--fz-caption);
  color: var(--text-secondary);
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

  button,
  .account__save {
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

.account__form-error {
  margin: 0;
  padding: var(--space-2);
  border-radius: var(--radius-sm);
  background: rgba(214, 69, 80, 0.1);
  color: var(--danger);
  font-size: var(--fz-caption);
}

.account__save--dirty {
  box-shadow: 0 0 0 2px rgba(255, 102, 0, 0.3);
}

.account__balance {
  display: grid;
  gap: var(--space-1);
  padding: var(--space-3);
  border-radius: var(--radius-md);
  background: rgba(0, 0, 0, 0.04);
  color: var(--text-secondary);

  strong {
    color: var(--text-primary);
    font-size: 20px;
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

.orders__refresh {
  border: none;
  border-radius: var(--radius-md);
  background: var(--accent);
  color: #fff;
  padding: var(--space-2) var(--space-4);
  font-weight: 600;

  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
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

.orders__bonus {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--space-2);
  font-size: var(--fz-caption);
  color: var(--text-secondary);

  strong {
    margin-left: var(--space-1);
    color: var(--text-primary);
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

.orders__empty {
  color: var(--text-secondary);
}

@media (max-width: $breakpoint-tablet) {
  .account__tabs {
    flex-wrap: wrap;
  }

  .account__tab {
    font-size: 14px;
    padding: var(--space-2) var(--space-3);
  }

  .orders__item {
    padding: var(--space-3);
  }

  .orders__item-line {
    font-size: 12px;
  }

  .orders__bonus {
    font-size: 12px;
  }

  .account__balance strong {
    font-size: 18px;
  }
}
</style>
