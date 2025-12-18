const ensureLeadingSlash = (path) => (path.startsWith('/') ? path : `/${path}`);
const stripTrailingSlash = (value) => value.replace(/\/+$/, '');
export const getAuthApiBase = () => {
    const raw = import.meta.env.VITE_AUTH_API_BASE;
    const value = typeof raw === 'string' ? raw.trim() : '';
    if (value)
        return stripTrailingSlash(value);
    if (import.meta.env.DEV) {
        // В dev удобнее использовать Vite proxy: VITE_AUTH_API_BASE=/api
        return '/api';
    }
    throw new Error('VITE_AUTH_API_BASE is not configured');
};
export const buildAuthApiUrl = (path) => {
    const base = getAuthApiBase();
    const normalizedPath = ensureLeadingSlash(path);
    return `${base}${normalizedPath}`;
};
