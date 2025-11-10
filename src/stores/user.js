import { defineStore } from 'pinia';
import productsMock from '@/mocks/products.json';
import { useCartStore } from './cart';
const fallbackProducts = productsMock;
const BANK_API_BASE = import.meta.env.VITE_BANK_API_BASE ?? '';
const createDefaultState = () => ({
    profile: null,
    addresses: [],
    orderHistory: [],
    pointsHistory: [],
    selectedAddressId: null,
    isLoadingProfile: false,
    isLoadingAddresses: false,
    isLoadingOrders: false,
    authToken: null,
});
async function requestBankApi(path, options) {
    if (!BANK_API_BASE) {
        throw new Error('BANK_API_BASE is not configured');
    }
    const response = await fetch(`${BANK_API_BASE}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(options?.headers ?? {}),
        },
    });
    if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Bank API request failed');
    }
    const payload = (await response.json());
    return payload.data;
}
export const useUserStore = defineStore('user', {
    state: createDefaultState,
    getters: {
        isAuthenticated: (state) => Boolean(state.profile?.id),
        loyaltyPoints: (state) => state.profile?.loyaltyPoints ?? 0,
    },
    actions: {
        reset() {
            Object.assign(this, createDefaultState());
        },
        setAuthToken(token) {
            this.authToken = token;
        },
        setProfileFromAuth(user) {
            if (!user) {
                this.profile = null;
                return;
            }
            this.profile = {
                id: user.id,
                email: user.email,
                name: user.name ?? formatNameFromEmail(user.email),
                phone: this.profile?.phone,
                loyaltyPoints: this.profile?.loyaltyPoints ?? 0,
            };
        },
        async fetchProfile() {
            this.isLoadingProfile = true;
            try {
                const { useAuthStore } = await import('./auth');
                const authStore = useAuthStore();
                this.setProfileFromAuth(authStore.user);
            }
            catch (error) {
                console.error('[User] Failed to sync profile from auth store', error);
            }
            finally {
                this.isLoadingProfile = false;
            }
        },
        async updateProfile(patch) {
            if (!this.authToken || !this.profile?.id)
                return;
            this.isLoadingProfile = true;
            try {
                const updated = await requestBankApi(`/users/${this.profile.id}`, {
                    method: 'PATCH',
                    body: JSON.stringify(patch),
                    headers: { Authorization: `Bearer ${this.authToken}` },
                });
                this.profile = updated;
            }
            catch (error) {
                logBankError(error);
                this.profile = { ...this.profile, ...patch };
            }
            finally {
                this.isLoadingProfile = false;
            }
        },
        async fetchAddresses() {
            if (!this.authToken)
                return;
            this.isLoadingAddresses = true;
            try {
                const addresses = await requestBankApi('/users/me/addresses', {
                    headers: { Authorization: `Bearer ${this.authToken}` },
                });
                this.addresses = addresses;
            }
            catch (error) {
                logBankError(error);
                if (!this.addresses.length) {
                    this.addresses = [
                        {
                            id: 'demo-address',
                            label: 'г. Москва, ул. Промышленная, 12',
                            lastSyncedAt: new Date().toISOString(),
                            isDefault: true,
                            details: {
                                receiver: 'Иван Иванов',
                                phone: '+7 (900) 111-22-33',
                                addressLine: 'Москва, Промышленная 12, офис 4',
                                comment: 'Позвонить за 30 минут',
                            },
                        },
                    ];
                    this.selectedAddressId = 'demo-address';
                }
            }
            finally {
                this.isLoadingAddresses = false;
            }
        },
        async startAddressBinding() {
            if (!this.authToken)
                return null;
            try {
                const { redirectUrl } = await requestBankApi('/users/me/addresses/session', {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${this.authToken}` },
                });
                return redirectUrl;
            }
            catch (error) {
                logBankError(error);
                return null;
            }
        },
        async addAddress(payload) {
            if (!this.authToken)
                return;
            this.isLoadingAddresses = true;
            try {
                const address = await requestBankApi('/users/me/addresses', {
                    method: 'POST',
                    body: JSON.stringify(payload),
                    headers: { Authorization: `Bearer ${this.authToken}` },
                });
                const exists = this.addresses.some((item) => item.id === address.id);
                this.addresses = exists ? this.addresses : [...this.addresses, address];
                if (!this.selectedAddressId) {
                    this.selectedAddressId = address.id;
                }
            }
            catch (error) {
                logBankError(error);
                const mockId = `mock-${Date.now()}`;
                this.addresses.push({
                    id: mockId,
                    label: 'Новый адрес (тестовый)',
                    lastSyncedAt: new Date().toISOString(),
                    isDefault: this.addresses.length === 0,
                });
                this.selectedAddressId = mockId;
            }
            finally {
                this.isLoadingAddresses = false;
            }
        },
        async removeAddress(addressId) {
            if (!this.authToken)
                return;
            this.isLoadingAddresses = true;
            try {
                await requestBankApi(`/users/me/addresses/${addressId}`, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${this.authToken}` },
                });
                this.addresses = this.addresses.filter((item) => item.id !== addressId);
                if (this.selectedAddressId === addressId) {
                    this.selectedAddressId = this.addresses[0]?.id ?? null;
                }
            }
            catch (error) {
                logBankError(error);
            }
            finally {
                this.isLoadingAddresses = false;
            }
        },
        setDefaultAddress(addressId) {
            this.addresses = this.addresses.map((address) => ({
                ...address,
                isDefault: address.id === addressId,
            }));
            this.selectedAddressId = addressId;
        },
        async fetchOrders() {
            if (!this.authToken)
                return;
            this.isLoadingOrders = true;
            try {
                const orders = await requestBankApi('/users/me/orders', {
                    headers: { Authorization: `Bearer ${this.authToken}` },
                });
                this.orderHistory = orders;
            }
            catch (error) {
                logBankError(error);
                if (!this.orderHistory.length) {
                    const fallbackTotal = { amount: 4011, currency: 'RUB' };
                    this.orderHistory = [
                        {
                            id: 'demo-order',
                            number: 'АВТОСИЛИКОН-0001',
                            createdAt: new Date().toISOString(),
                            status: 'delivered',
                            total: fallbackTotal,
                            shippingAddressId: this.selectedAddressId ?? this.addresses[0]?.id,
                            items: buildFallbackOrderItems([
                                { productId: 'p-1001', quantity: 1 },
                                { productId: 'p-1004', quantity: 2 },
                            ]),
                        },
                    ];
                }
            }
            finally {
                this.isLoadingOrders = false;
            }
        },
        async repeatOrder(payload) {
            if (!this.authToken)
                return;
            const cartStore = useCartStore();
            const order = this.orderHistory.find((item) => item.id === payload.orderId);
            if (order) {
                order.items.forEach((line) => {
                    const product = findProduct(line.productId);
                    if (product) {
                        cartStore.addItem({
                            productId: product.id,
                            quantity: line.quantity,
                            price: product.price,
                        });
                    }
                });
                cartStore.toggleCart(true);
            }
            try {
                await requestBankApi(`/users/me/orders/${payload.orderId}/repeat`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${this.authToken}` },
                });
            }
            catch (error) {
                logBankError(error);
            }
        },
        redeemPoints(amount) {
            if (!this.profile)
                return;
            if (amount <= 0)
                return;
            if (amount > (this.profile.loyaltyPoints ?? 0)) {
                throw new Error('Недостаточно баллов');
            }
            this.profile.loyaltyPoints = (this.profile.loyaltyPoints ?? 0) - amount;
            this.pointsHistory.unshift({
                id: `redeem-${Date.now()}`,
                type: 'spend',
                amount,
                description: 'Списание баллов по запросу пользователя',
                createdAt: new Date().toISOString(),
            });
        },
        accruePoints(amount, description) {
            if (!this.profile || amount <= 0)
                return;
            this.profile.loyaltyPoints = (this.profile.loyaltyPoints ?? 0) + amount;
            this.pointsHistory.unshift({
                id: `earn-${Date.now()}`,
                type: 'earn',
                amount,
                description,
                createdAt: new Date().toISOString(),
            });
        },
        assignAddressToOrder(orderId, addressId) {
            this.orderHistory = this.orderHistory.map((order) => order.id === orderId ? { ...order, shippingAddressId: addressId } : order);
        },
    },
});
function logBankError(error) {
    console.error('[Bank API]', error);
}
function findProduct(productId) {
    return fallbackProducts.find((product) => product.id === productId);
}
function buildFallbackOrderItems(items) {
    return items
        .map((line) => {
        const product = findProduct(line.productId);
        if (!product)
            return null;
        return {
            productId: product.id,
            title: product.title,
            quantity: line.quantity,
            price: product.price,
        };
    })
        .filter(Boolean);
}
function formatNameFromEmail(email) {
    return email.split('@')[0] || email;
}
