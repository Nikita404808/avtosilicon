const AUTH_API_BASE = import.meta.env.VITE_AUTH_API_BASE ?? 'http://79.174.85.129:3000';
async function request(path, options) {
    const response = await fetch(`${AUTH_API_BASE}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(options?.headers ?? {}),
        },
    });
    if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Delivery API request failed');
    }
    return response.json();
}
export async function searchPvz(provider, city, query) {
    return request('/api/delivery/pvz/search', {
        method: 'POST',
        body: JSON.stringify({ provider, city, query }),
    });
}
export async function calculateDelivery(body, options) {
    return request('/api/delivery/calculate', {
        method: 'POST',
        body: JSON.stringify(body),
        signal: options?.signal,
    });
}
export async function tariffs(body, options) {
    return request('/api/delivery/tariffs', {
        method: 'POST',
        body: JSON.stringify(body),
        signal: options?.signal,
    });
}
