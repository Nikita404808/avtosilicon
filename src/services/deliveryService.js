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
function formatPublicDeliveryError(debugMessage, status) {
    const normalized = debugMessage.replace(/^YANDEX:\s*/i, '').trim();
    if (!normalized)
        return DELIVERY_PUBLIC_ERROR_MESSAGE;
    if (status && status >= 400 && status < 500) {
        if (/not_present_in_tariff_line_strategy/i.test(normalized) ||
            /нет доступного тарифа|вне зоны текущих тарифов|тарифной линейке/i.test(normalized)) {
            return 'Для выбранного маршрута Яндекс-доставка сейчас недоступна. Выберите другой ПВЗ или доставку до двери.';
        }
        return normalized;
    }
    return DELIVERY_PUBLIC_ERROR_MESSAGE;
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
        const publicMessage = formatPublicDeliveryError(debugMessage, response.status);
        throw new DeliveryRequestError(publicMessage, debugMessage, response.status);
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
        const publicMessage = formatPublicDeliveryError(debugMessage);
        throw new DeliveryRequestError(publicMessage, debugMessage);
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
