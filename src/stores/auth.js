import { defineStore } from 'pinia';
const USERS_STORAGE_KEY = 'cs20.auth.users';
const SESSION_STORAGE_KEY = 'cs20.auth.session';
const RESET_TOKENS_STORAGE_KEY = 'cs20.auth.resetTokens';
const RESET_TOKEN_TTL_MS = 1000 * 60 * 15;
const defaultState = () => ({
    user: null,
    token: null,
    isAuthModalOpen: false,
    authError: null,
});
export const useAuthStore = defineStore('auth', {
    state: defaultState,
    getters: {
        isAuthenticated: (state) => Boolean(state.user && state.token),
    },
    actions: {
        toggleModal(isOpen) {
            this.isAuthModalOpen = typeof isOpen === 'boolean' ? isOpen : !this.isAuthModalOpen;
            if (!this.isAuthModalOpen) {
                this.setError(null);
            }
        },
        setError(message) {
            this.authError = message;
        },
        async initialize() {
            if (!isStorageAvailable())
                return;
            this.cleanupExpiredResetTokens();
            const rawSession = window.localStorage.getItem(SESSION_STORAGE_KEY);
            if (!rawSession)
                return;
            try {
                const session = JSON.parse(rawSession);
                if (!session.email || !session.token) {
                    this.clearSession();
                    return;
                }
                this.user = {
                    id: session.email,
                    email: session.email,
                    name: formatNameFromEmail(session.email),
                };
                this.token = session.token;
                const { useUserStore } = await import('./user');
                const userStore = useUserStore();
                userStore.setAuthToken(session.token);
                await Promise.all([
                    userStore.fetchProfile(),
                    userStore.fetchAddresses(),
                    userStore.fetchOrders(),
                ]);
            }
            catch (error) {
                console.error('[Auth] Failed to restore session', error);
                this.clearSession();
            }
        },
        async register(payload) {
            this.setError(null);
            if (!payload.email || !payload.password) {
                const message = 'Введите email и пароль.';
                this.setError(message);
                throw new Error(message);
            }
            const users = this.getStoredUsers();
            if (users.some((user) => user.email === payload.email)) {
                const message = 'Пользователь с таким email уже зарегистрирован.';
                this.setError(message);
                throw new Error(message);
            }
            const passwordHash = await hashPassword(payload.password);
            const newUser = {
                email: payload.email,
                passwordHash,
                createdAt: new Date().toISOString(),
            };
            users.push(newUser);
            this.saveStoredUsers(users);
            await this.login(payload);
        },
        async login(payload) {
            this.setError(null);
            if (!payload.email || !payload.password) {
                const message = 'Введите email и пароль.';
                this.setError(message);
                throw new Error(message);
            }
            const users = this.getStoredUsers();
            const storedUser = users.find((user) => user.email === payload.email);
            if (!storedUser) {
                const message = 'Неверный email или пароль.';
                this.setError(message);
                throw new Error(message);
            }
            const passwordHash = await hashPassword(payload.password);
            if (storedUser.passwordHash !== passwordHash) {
                const message = 'Неверный email или пароль.';
                this.setError(message);
                throw new Error(message);
            }
            const token = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);
            this.user = {
                id: payload.email,
                email: payload.email,
                name: formatNameFromEmail(payload.email),
            };
            this.token = token;
            this.persistSession({ email: payload.email, token });
            const { useUserStore } = await import('./user');
            const userStore = useUserStore();
            userStore.setAuthToken(token);
            await Promise.all([
                userStore.fetchProfile(),
                userStore.fetchAddresses(),
                userStore.fetchOrders(),
            ]);
            this.toggleModal(false);
        },
        async signIn(payload) {
            await this.login(payload);
        },
        async signOut() {
            const { useUserStore } = await import('./user');
            useUserStore().reset();
            this.clearSession();
        },
        async logout() {
            await this.signOut();
        },
        clearSession() {
            if (isStorageAvailable()) {
                window.localStorage.removeItem(SESSION_STORAGE_KEY);
            }
            this.user = null;
            this.token = null;
            this.setError(null);
        },
        async requestPasswordReset(email) {
            this.setError(null);
            const users = this.getStoredUsers();
            const exists = users.some((user) => user.email === email);
            if (!exists) {
                const message = 'Пользователь с таким email не найден.';
                this.setError(message);
                throw new Error(message);
            }
            const token = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);
            const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS).toISOString();
            const tokens = this.getStoredResetTokens().filter((item) => item.email !== email);
            tokens.push({ token, email, expiresAt });
            this.saveStoredResetTokens(tokens);
            return token;
        },
        validateResetToken(token) {
            this.cleanupExpiredResetTokens();
            const tokens = this.getStoredResetTokens();
            const entry = tokens.find((item) => item.token === token);
            return entry ?? null;
        },
        async resetPasswordWithToken(payload) {
            this.setError(null);
            this.cleanupExpiredResetTokens();
            const tokens = this.getStoredResetTokens();
            const entry = tokens.find((item) => item.token === payload.token);
            if (!entry) {
                const message = 'Токен недействителен или устарел.';
                this.setError(message);
                throw new Error(message);
            }
            const users = this.getStoredUsers();
            const passwordHash = await hashPassword(payload.newPassword);
            const updatedUsers = users.map((user) => user.email === entry.email ? { ...user, passwordHash } : user);
            this.saveStoredUsers(updatedUsers);
            const filteredTokens = tokens.filter((item) => item.token !== payload.token);
            this.saveStoredResetTokens(filteredTokens);
            await this.login({ email: entry.email, password: payload.newPassword });
        },
        getStoredResetTokens() {
            if (!isStorageAvailable())
                return [];
            const raw = window.localStorage.getItem(RESET_TOKENS_STORAGE_KEY);
            if (!raw)
                return [];
            try {
                return JSON.parse(raw);
            }
            catch (error) {
                console.warn('[Auth] Failed to parse reset tokens', error);
                return [];
            }
        },
        saveStoredResetTokens(tokens) {
            if (!isStorageAvailable())
                return;
            window.localStorage.setItem(RESET_TOKENS_STORAGE_KEY, JSON.stringify(tokens));
        },
        cleanupExpiredResetTokens() {
            const tokens = this.getStoredResetTokens();
            const now = Date.now();
            const filtered = tokens.filter((token) => new Date(token.expiresAt).getTime() > now);
            this.saveStoredResetTokens(filtered);
        },
        getStoredUsers() {
            if (!isStorageAvailable())
                return [];
            const raw = window.localStorage.getItem(USERS_STORAGE_KEY);
            if (!raw)
                return [];
            try {
                return JSON.parse(raw);
            }
            catch (error) {
                console.warn('[Auth] Failed to parse stored users', error);
                return [];
            }
        },
        saveStoredUsers(users) {
            if (!isStorageAvailable())
                return;
            window.localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
        },
        persistSession(session) {
            if (!isStorageAvailable())
                return;
            window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
        },
    },
});
function isStorageAvailable() {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}
function formatNameFromEmail(email) {
    return email.split('@')[0] || email;
}
async function hashPassword(password) {
    const cryptoSubtle = globalThis.crypto?.subtle;
    if (cryptoSubtle) {
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hashBuffer = await cryptoSubtle.digest('SHA-256', data);
        return bufferToHex(hashBuffer);
    }
    return simpleHash(password);
}
function bufferToHex(buffer) {
    return Array.from(new Uint8Array(buffer))
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
}
function simpleHash(value) {
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
        const char = value.charCodeAt(index);
        hash = (hash << 5) - hash + char;
        hash |= 0;
    }
    return Math.abs(hash).toString(16);
}
