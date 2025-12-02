import { defineStore } from 'pinia';
import router from '@/router';

type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  emailVerified: boolean;
};

type AuthState = {
  user: AuthUser | null;
  token: string | null;
  isAuthModalOpen: boolean;
  authModalMode: 'login' | 'register';
  authError: string | null;
  postAuthRedirect: string | null;
};

const SESSION_STORAGE_KEY = 'auth_token';
const AUTH_API_BASE = import.meta.env.VITE_AUTH_API_BASE ?? 'http://31.31.207.27:3000';
const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY ?? '';

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
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
    toggleModal(isOpen?: boolean, mode: 'login' | 'register' = 'login') {
      this.authModalMode = mode;
      this.isAuthModalOpen = typeof isOpen === 'boolean' ? isOpen : !this.isAuthModalOpen;
      if (!this.isAuthModalOpen) {
        this.setError(null);
      }
    },
    setModalMode(mode: 'login' | 'register') {
      this.authModalMode = mode;
    },
    setError(message: string | null) {
      this.authError = message;
    },
    async initialize() {
      if (!isStorageAvailable()) return;
      const token = window.localStorage.getItem(SESSION_STORAGE_KEY);
      if (!token) return;

      try {
        const me = await requestAuth<AuthResponse>('/api/auth/me', {
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
      } catch (error) {
        console.error('[Auth] Failed to restore session', error);
        const { useUserStore } = await import('./user');
        useUserStore().reset();
        this.clearSession();
      }
    },
    async register(payload: { email: string; password: string }) {
      this.validateCredentials(payload);
      try {
        const recaptchaToken = await getRecaptchaToken('register');
        const body = {
          email: payload.email,
          password: payload.password,
          ...(recaptchaToken ? { recaptchaToken } : {}),
        };
        const response = await requestAuth<AuthResponse & { token: string }>('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify(body),
        });
        await this.syncAuthSession(response);
      } catch (error) {
        this.handleRequestError(error);
      }
    },
    async login(payload: { email: string; password: string }) {
      this.validateCredentials(payload);
      try {
        const response = await requestAuth<AuthResponse & { token: string }>('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        await this.syncAuthSession(response);
      } catch (error) {
        this.handleRequestError(error);
      }
    },
    async syncAuthSession(response: AuthResponse & { token?: string }) {
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
    handleRequestError(error: unknown) {
      const message = error instanceof Error ? error.message : 'Не удалось выполнить запрос.';
      this.setError(message);
      throw error instanceof Error ? error : new Error(message);
    },
    validateCredentials(payload: { email: string; password: string }) {
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
    persistSession(token: string) {
      if (!isStorageAvailable()) return;
      window.localStorage.setItem(SESSION_STORAGE_KEY, token);
    },
    setPostAuthRedirect(path: string | null) {
      this.postAuthRedirect = path;
    },
    async navigateAfterAuth() {
      if (!this.postAuthRedirect) return;
      const redirect = this.postAuthRedirect;
      this.postAuthRedirect = null;
      try {
        await router.push(redirect);
      } catch (error) {
        console.warn('[Auth] Failed to navigate after login', error);
      }
    },
    async sendVerifyCode() {
      if (!this.token) throw new Error('Требуется авторизация.');
      await requestAuth('/api/auth/send-verify-code', {
        method: 'POST',
        headers: this.buildAuthHeaders(),
      });
    },
    async verifyEmail(token: string) {
      if (!token) throw new Error('Введите код подтверждения.');
      await requestAuth('/api/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ token }),
      });
      this.patchUser({ emailVerified: true });
    },
    async requestPasswordReset(email: string) {
      if (!email) {
        this.setError('Введите email.');
        throw new Error('Введите email.');
      }
      await requestAuth('/api/auth/request-password-reset', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
    },
    async resetPassword(payload: { token: string; newPassword: string }) {
      if (!payload.token || !payload.newPassword) {
        throw new Error('Введите токен и новый пароль.');
      }
      await requestAuth('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    buildAuthHeaders() {
      if (!this.token) throw new Error('Нет токена.');
      return { Authorization: `Bearer ${this.token}` };
    },
    patchUser(patch: Partial<AuthUser>) {
      if (!this.user) return;
      this.user = { ...this.user, ...patch };
    },
  },
});

type AuthResponse = {
  id: string | number;
  email: string;
  name?: string | null;
  email_verified?: boolean;
  token?: string;
};

function isStorageAvailable() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function formatNameFromEmail(email: string) {
  return email.split('@')[0] || email;
}

async function requestAuth<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = {
    ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
    ...(options?.headers ?? {}),
  };

  const response = await fetch(`${AUTH_API_BASE}${path}`, {
    ...options,
    headers,
  });

  const raw = await response.text();
  let data: unknown = null;
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch (error) {
      console.warn('[Auth] Failed to parse auth API response', error);
    }
  }

  if (!response.ok) {
    const message = isRecord(data) && typeof data.message === 'string'
      ? data.message
      : 'Не удалось выполнить запрос к серверу авторизации.';
    throw new Error(message);
  }

  return data as T;
}

function buildAuthUser(payload: AuthResponse): AuthUser {
  return {
    id: String(payload.id),
    email: payload.email,
    name: payload.name ?? formatNameFromEmail(payload.email),
    emailVerified: Boolean(payload.email_verified),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

type Grecaptcha = {
  ready(callback: () => void): void;
  execute(siteKey: string, options: { action: string }): Promise<string>;
};

declare global {
  interface Window {
    grecaptcha?: Grecaptcha;
  }
}

let recaptchaScriptPromise: Promise<void> | null = null;

async function getRecaptchaToken(action: string): Promise<string | null> {
  if (typeof window === 'undefined' || !RECAPTCHA_SITE_KEY) return null;
  await ensureRecaptchaScript();
  if (!window.grecaptcha) {
    return null;
  }
  await new Promise<void>((resolve) => window.grecaptcha!.ready(() => resolve()));
  try {
    return await window.grecaptcha.execute(RECAPTCHA_SITE_KEY, { action });
  } catch (error) {
    console.warn('[Auth] Failed to get reCAPTCHA token', error);
    return null;
  }
}

async function ensureRecaptchaScript() {
  if (typeof document === 'undefined' || window.grecaptcha || !RECAPTCHA_SITE_KEY) {
    return;
  }
  if (!recaptchaScriptPromise) {
    recaptchaScriptPromise = new Promise<void>((resolve, reject) => {
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
  } catch (error) {
    console.warn('[Auth] Failed to load reCAPTCHA script', error);
  }
}
