import { defineStore } from 'pinia';
import router from '@/router';
const SESSION_STORAGE_KEY = 'auth_token';
const AUTH_API_BASE = import.meta.env.VITE_AUTH_API_BASE ?? 'http://79.174.85.129:3000';
const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY ?? '';
export const useAuthStore = defineStore('auth', {
    state: () => ({
        user: null,
        token: null,
        isAuthModalOpen: false,
        authModalMode: 'login',
        authError: null,
        postAuthRedirect: null,
    }),
    getters: {
        isAuthenticated: (state) => Boolean(state.user && state.token),
        needsEmailVerification: (state) => Boolean(state.user && !state.user.emailVerified),
    },
    actions: {
        toggleModal(isOpen, mode = 'login') {
            this.authModalMode = mode;
            this.isAuthModalOpen = typeof isOpen === 'boolean' ? isOpen : !this.isAuthModalOpen;
            if (!this.isAuthModalOpen) {
                this.setError(null);
            }
        },
        setModalMode(mode) {
            this.authModalMode = mode;
        },
        setError(message) {
            this.authError = message;
        },
        async initialize() {
            if (!isStorageAvailable())
                return;
            const token = window.localStorage.getItem(SESSION_STORAGE_KEY);
            if (!token)
                return;
            try {
                const me = await requestAuth('/api/auth/me', {
                    headers: { Authorization: `Bearer ${token}` },
                });
                this.user = buildAuthUser(me);
                this.token = token;
                this.persistSession(token);
                const { useUserStore } = await import('./user');
                const userStore = useUserStore();
                userStore.setAuthToken(token);
                userStore.setProfileFromAuth(this.user);
                await Promise.all([
                    userStore.fetchProfile(),
                    userStore.fetchAddresses(),
                    userStore.fetchOrders(),
                ]);
            }
            catch (error) {
                console.error('[Auth] Failed to restore session', error);
                const { useUserStore } = await import('./user');
                useUserStore().reset();
                this.clearSession();
            }
        },
        async register(payload) {
            this.validateCredentials(payload);
            try {
                const recaptchaToken = await getRecaptchaToken('register');
                const body = {
                    email: payload.email,
                    password: payload.password,
                    ...(recaptchaToken ? { recaptchaToken } : {}),
                };
                const response = await requestAuth('/api/auth/register', {
                    method: 'POST',
                    body: JSON.stringify(body),
                });
                await this.syncAuthSession(response);
            }
            catch (error) {
                this.handleRequestError(error);
            }
        },
        async login(payload) {
            this.validateCredentials(payload);
            try {
                const response = await requestAuth('/api/auth/login', {
                    method: 'POST',
                    body: JSON.stringify(payload),
                });
                await this.syncAuthSession(response);
            }
            catch (error) {
                this.handleRequestError(error);
            }
        },
        async syncAuthSession(response) {
            const authUser = buildAuthUser(response);
            this.user = authUser;
            if (response.token) {
                this.token = response.token;
                this.persistSession(response.token);
            }
            const { useUserStore } = await import('./user');
            const userStore = useUserStore();
            if (this.token) {
                userStore.setAuthToken(this.token);
            }
            userStore.setProfileFromAuth(authUser);
            await Promise.all([
                userStore.fetchProfile(),
                userStore.fetchAddresses(),
                userStore.fetchOrders(),
            ]);
            this.toggleModal(false);
            await this.navigateAfterAuth();
        },
        handleRequestError(error) {
            const message = error instanceof Error ? error.message : 'Не удалось выполнить запрос.';
            this.setError(message);
            throw error instanceof Error ? error : new Error(message);
        },
        validateCredentials(payload) {
            this.setError(null);
            if (!payload.email || !payload.password) {
                const message = 'Введите email и пароль.';
                this.setError(message);
                throw new Error(message);
            }
        },
        async logout() {
            const { useUserStore } = await import('./user');
            useUserStore().reset();
            this.clearSession();
        },
        clearSession() {
            if (isStorageAvailable()) {
                window.localStorage.removeItem(SESSION_STORAGE_KEY);
            }
            this.user = null;
            this.token = null;
            this.postAuthRedirect = null;
            this.setError(null);
        },
        persistSession(token) {
            if (!isStorageAvailable())
                return;
            window.localStorage.setItem(SESSION_STORAGE_KEY, token);
        },
        setPostAuthRedirect(path) {
            this.postAuthRedirect = path;
        },
        async navigateAfterAuth() {
            if (!this.postAuthRedirect)
                return;
            const redirect = this.postAuthRedirect;
            this.postAuthRedirect = null;
            try {
                await router.push(redirect);
            }
            catch (error) {
                console.warn('[Auth] Failed to navigate after login', error);
            }
        },
        async sendVerifyCode() {
            if (!this.token)
                throw new Error('Требуется авторизация.');
            await requestAuth('/api/auth/send-verify-code', {
                method: 'POST',
                headers: this.buildAuthHeaders(),
            });
        },
        async verifyEmail(token) {
            if (!token)
                throw new Error('Введите код подтверждения.');
            await requestAuth('/api/auth/verify-email', {
                method: 'POST',
                body: JSON.stringify({ token }),
            });
            this.patchUser({ emailVerified: true });
        },
        async requestPasswordReset(email) {
            if (!email) {
                this.setError('Введите email.');
                throw new Error('Введите email.');
            }
            await requestAuth('/api/auth/request-password-reset', {
                method: 'POST',
                body: JSON.stringify({ email }),
            });
        },
        async resetPassword(payload) {
            if (!payload.token || !payload.newPassword) {
                throw new Error('Введите токен и новый пароль.');
            }
            await requestAuth('/api/auth/reset-password', {
                method: 'POST',
                body: JSON.stringify(payload),
            });
        },
        buildAuthHeaders() {
            if (!this.token)
                throw new Error('Нет токена.');
            return { Authorization: `Bearer ${this.token}` };
        },
        patchUser(patch) {
            if (!this.user)
                return;
            this.user = { ...this.user, ...patch };
        },
    },
});
function isStorageAvailable() {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}
function formatNameFromEmail(email) {
    return email.split('@')[0] || email;
}
async function requestAuth(path, options) {
    const headers = {
        ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options?.headers ?? {}),
    };
    const response = await fetch(`${AUTH_API_BASE}${path}`, {
        ...options,
        headers,
    });
    const raw = await response.text();
    let data = null;
    if (raw) {
        try {
            data = JSON.parse(raw);
        }
        catch (error) {
            console.warn('[Auth] Failed to parse auth API response', error);
        }
    }
    if (!response.ok) {
        const message = isRecord(data) && typeof data.message === 'string'
            ? data.message
            : 'Не удалось выполнить запрос к серверу авторизации.';
        throw new Error(message);
    }
    return data;
}
function buildAuthUser(payload) {
    return {
        id: String(payload.id),
        email: payload.email,
        name: payload.name ?? formatNameFromEmail(payload.email),
        emailVerified: Boolean(payload.email_verified),
        bonusBalance: normalizeBonusBalance(payload.bonus_balance ?? payload.bonusBalance),
    };
}
function normalizeBonusBalance(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric))
        return 0;
    return Math.max(0, Math.floor(numeric));
}
function isRecord(value) {
    return Boolean(value) && typeof value === 'object';
}
let recaptchaScriptPromise = null;
async function getRecaptchaToken(action) {
    if (typeof window === 'undefined' || !RECAPTCHA_SITE_KEY)
        return null;
    await ensureRecaptchaScript();
    if (!window.grecaptcha) {
        return null;
    }
    await new Promise((resolve) => window.grecaptcha.ready(() => resolve()));
    try {
        return await window.grecaptcha.execute(RECAPTCHA_SITE_KEY, { action });
    }
    catch (error) {
        console.warn('[Auth] Failed to get reCAPTCHA token', error);
        return null;
    }
}
async function ensureRecaptchaScript() {
    if (typeof document === 'undefined' || window.grecaptcha || !RECAPTCHA_SITE_KEY) {
        return;
    }
    if (!recaptchaScriptPromise) {
        recaptchaScriptPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`;
            script.async = true;
            script.onload = () => resolve();
            script.onerror = (event) => {
                recaptchaScriptPromise = null;
                reject(event);
            };
            document.head.appendChild(script);
        });
    }
    try {
        await recaptchaScriptPromise;
    }
    catch (error) {
        console.warn('[Auth] Failed to load reCAPTCHA script', error);
    }
}
