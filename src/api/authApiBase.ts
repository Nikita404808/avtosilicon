const ensureLeadingSlash = (path: string) => (path.startsWith('/') ? path : `/${path}`);

const stripTrailingSlash = (value: string) => value.replace(/\/+$/, '');

export const getAuthApiBase = (): string => {
  const raw = import.meta.env.VITE_AUTH_API_BASE;
  const value = typeof raw === 'string' ? raw.trim() : '';

  if (value) return stripTrailingSlash(value);

  if (import.meta.env.DEV) {
    // В dev удобнее использовать Vite proxy: VITE_AUTH_API_BASE=/api
    return '/api';
  }

  throw new Error('VITE_AUTH_API_BASE is not configured');
};

export const buildAuthApiUrl = (path: string): string => {
  const base = getAuthApiBase();
  const normalizedPath = ensureLeadingSlash(path);

  return `${base}${normalizedPath}`;
};

