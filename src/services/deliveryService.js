import { buildAuthApiUrl } from '@/api/authApiBase';
const DELIVERY_PUBLIC_ERROR_MESSAGE = 'Ошибка, проверьте данные';
export class DeliveryRequestError extends Error {
    publicMessage;
    debugMessage;
    status;
    constructor(publicMessage, debugMessage, status) {
        super(publicMessage);
        this.name = 'DeliveryRequestError';
        this.publicMessage = publicMessage;
        this.debugMessage = debugMessage;
        this.status = status;
    }
}
function extractErrorText(payload) {
    if (!payload || typeof payload !== 'object')
        return null;
    const record = payload;
    if (typeof record.error === 'string' && record.error.trim())
        return record.error.trim();
    if (typeof record.message === 'string' && record.message.trim())
        return record.message.trim();
    return null;
}
async function request(path, options) {
    const response = await fetch(buildAuthApiUrl(path), {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(options?.headers ?? {}),
        },
    });
    if (!response.ok) {
        const rawText = await response.text();
        let debugMessage = rawText || `HTTP ${response.status}`;
        try {
            const parsed = rawText ? JSON.parse(rawText) : null;
            debugMessage = extractErrorText(parsed) ?? debugMessage;
        }
        catch {
            // ignore json parse errors
        }
        if (import.meta.env.DEV) {
            console.error('[Delivery] API request failed', { path, status: response.status, debugMessage });
        }
        throw new DeliveryRequestError(DELIVERY_PUBLIC_ERROR_MESSAGE, debugMessage, response.status);
    }
    return response.json();
}
export async function searchPvz(provider, city, query) {
    return request('/delivery/pvz/search', {
        method: 'POST',
        body: JSON.stringify({ provider, city, query }),
    });
}
export async function calculateDelivery(body, options) {
    const result = await request('/delivery/calculate', {
        method: 'POST',
        body: JSON.stringify(body),
        signal: options?.signal,
    });
    const debugMessage = extractErrorText(result);
    if (debugMessage) {
        if (import.meta.env.DEV) {
            console.error('[Delivery] API returned error payload', { path: '/delivery/calculate', debugMessage });
        }
        throw new DeliveryRequestError(DELIVERY_PUBLIC_ERROR_MESSAGE, debugMessage);
    }
    return result;
}
export async function tariffs(body, options) {
    return request('/delivery/tariffs', {
        method: 'POST',
        body: JSON.stringify(body),
        signal: options?.signal,
    });
}
