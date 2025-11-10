import { defineStore } from 'pinia';

type AuthUser = {
  id: string;
  email: string;
  name?: string;
};

type StoredUser = {
  email: string;
  passwordHash: string;
  createdAt: string;
};

type AuthState = {
  user: AuthUser | null;
  token: string | null;
  isAuthModalOpen: boolean;
  authError: string | null;
};

const USERS_STORAGE_KEY = 'cs20.auth.users';
const SESSION_STORAGE_KEY = 'auth_token';
const RESET_TOKENS_STORAGE_KEY = 'cs20.auth.resetTokens';
const RESET_TOKEN_TTL_MS = 1000 * 60 * 15;

const AUTH_API_BASE = import.meta.env.VITE_AUTH_API_BASE ?? 'http://31.31.207.27:3000';

type AuthSuccessResponse = {
  id: string | number;
  email: string;
  token: string;
};

type AuthUserResponse = {
  id: string | number;
  email: string;
};

type ResetToken = {
  token: string;
  email: string;
  expiresAt: string;
};

const defaultState = (): AuthState => ({
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
    toggleModal(isOpen?: boolean) {
      this.isAuthModalOpen = typeof isOpen === 'boolean' ? isOpen : !this.isAuthModalOpen;
      if (!this.isAuthModalOpen) {
        this.setError(null);
      }
    },
    setError(message: string | null) {
      this.authError = message;
    },
    async initialize() {
      if (!isStorageAvailable()) return;
      this.cleanupExpiredResetTokens();
      const token = window.localStorage.getItem(SESSION_STORAGE_KEY);
      if (!token) return;

      try {
        const me = await requestAuth<AuthUserResponse>('/api/auth/me', {
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
      this.setError(null);
      if (!payload.email || !payload.password) {
        const message = 'Введите email и пароль.';
        this.setError(message);
        throw new Error(message);
      }

      try {
        const response = await requestAuth<AuthSuccessResponse>('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify({ email: payload.email, password: payload.password }),
        });

        await this.syncAuthSession(response, payload.password);
        this.toggleModal(false);
      } catch (error) {
        this.handleRequestError(error);
      }
    },
    async login(payload: { email: string; password: string }) {
      this.setError(null);
      if (!payload.email || !payload.password) {
        const message = 'Введите email и пароль.';
        this.setError(message);
        throw new Error(message);
      }

      try {
        const response = await requestAuth<AuthSuccessResponse>('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email: payload.email, password: payload.password }),
        });

        await this.syncAuthSession(response, payload.password);
        this.toggleModal(false);
      } catch (error) {
        this.handleRequestError(error);
      }
    },
    async syncAuthSession(response: AuthSuccessResponse, plaintextPassword?: string) {
      const authUser = buildAuthUser(response);
      this.user = authUser;
      this.token = response.token;
      this.persistSession(response.token);

      if (plaintextPassword) {
        await this.persistLocalShadowUser(authUser.email, plaintextPassword);
      }

      const { useUserStore } = await import('./user');
      const userStore = useUserStore();
      userStore.setAuthToken(response.token);
      userStore.setProfileFromAuth(authUser);
      await Promise.all([
        userStore.fetchProfile(),
        userStore.fetchAddresses(),
        userStore.fetchOrders(),
      ]);
    },
    async persistLocalShadowUser(email: string, password: string) {
      const users = this.getStoredUsers().filter((user) => user.email !== email);
      const passwordHash = await hashPassword(password);
      users.push({ email, passwordHash, createdAt: new Date().toISOString() });
      this.saveStoredUsers(users);
    },
    handleRequestError(error: unknown) {
      const message = error instanceof Error ? error.message : 'Не удалось выполнить запрос.';
      this.setError(message);
      throw error instanceof Error ? error : new Error(message);
    },
    async signIn(payload: { email: string; password: string }) {
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
    async requestPasswordReset(email: string) {
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
    validateResetToken(token: string) {
      this.cleanupExpiredResetTokens();
      const tokens = this.getStoredResetTokens();
      const entry = tokens.find((item) => item.token === token);
      return entry ?? null;
    },
    async resetPasswordWithToken(payload: { token: string; newPassword: string }) {
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
      const updatedUsers = users.map((user) =>
        user.email === entry.email ? { ...user, passwordHash } : user,
      );
      this.saveStoredUsers(updatedUsers);

      const filteredTokens = tokens.filter((item) => item.token !== payload.token);
      this.saveStoredResetTokens(filteredTokens);

      await this.login({ email: entry.email, password: payload.newPassword });
    },
    getStoredResetTokens(): ResetToken[] {
      if (!isStorageAvailable()) return [];
      const raw = window.localStorage.getItem(RESET_TOKENS_STORAGE_KEY);
      if (!raw) return [];
      try {
        return JSON.parse(raw) as ResetToken[];
      } catch (error) {
        console.warn('[Auth] Failed to parse reset tokens', error);
        return [];
      }
    },
    saveStoredResetTokens(tokens: ResetToken[]) {
      if (!isStorageAvailable()) return;
      window.localStorage.setItem(RESET_TOKENS_STORAGE_KEY, JSON.stringify(tokens));
    },
    cleanupExpiredResetTokens() {
      const tokens = this.getStoredResetTokens();
      const now = Date.now();
      const filtered = tokens.filter((token) => new Date(token.expiresAt).getTime() > now);
      this.saveStoredResetTokens(filtered);
    },
    getStoredUsers(): StoredUser[] {
      if (!isStorageAvailable()) return [];
      const raw = window.localStorage.getItem(USERS_STORAGE_KEY);
      if (!raw) return [];
      try {
        return JSON.parse(raw) as StoredUser[];
      } catch (error) {
        console.warn('[Auth] Failed to parse stored users', error);
        return [];
      }
    },
    saveStoredUsers(users: StoredUser[]) {
      if (!isStorageAvailable()) return;
      window.localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
    },
    persistSession(token: string) {
      if (!isStorageAvailable()) return;
      window.localStorage.setItem(SESSION_STORAGE_KEY, token);
    },
  },
});

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

function buildAuthUser(payload: AuthUserResponse | AuthSuccessResponse): AuthUser {
  return {
    id: String(payload.id),
    email: payload.email,
    name: formatNameFromEmail(payload.email),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

async function hashPassword(password: string): Promise<string> {
  const cryptoSubtle = globalThis.crypto?.subtle;
  if (cryptoSubtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await cryptoSubtle.digest('SHA-256', data);
    return bufferToHex(hashBuffer);
  }

  return simpleHash(password);
}

function bufferToHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function simpleHash(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    const char = value.charCodeAt(index);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
}
