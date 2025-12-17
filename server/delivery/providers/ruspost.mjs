const BASE_URL = process.env.RUSPOST_API_BASE || 'https://tariff.pochta.ru';
const originIndex = process.env.RUSPOST_ORIGIN_INDEX;
const objectCode = process.env.RUSPOST_OBJECT_CODE;

export async function searchPvz({ query, city, lat, lon }) {
  // Пока оставляем минимальную реализацию. Для Почты РФ в UI используем "ПВЗ = индекс".
  void query;
  void city;
  void lat;
  void lon;
  return [];
}

export async function calculate({ provider, type, total_weight, pickup_point_id, address }) {
  void provider;
  ensureConfigured();

  const weightKg = Number(total_weight);
  if (!Number.isFinite(weightKg) || weightKg <= 0) {
    throw new Error('RUSPOST: вес отправления обязателен.');
  }

  const fromIndex = requireEnv(originIndex, 'RUSPOST_ORIGIN_INDEX');
  const object = requireEnv(objectCode, 'RUSPOST_OBJECT_CODE');

  const toIndex =
    type === 'pvz'
      ? normalizePostalIndex(pickup_point_id, 'pickup_point_id')
      : normalizePostalIndex(normalizeAddress(address).postal_code, 'address.postal_code');

  const weightGrams = toWeightGrams(weightKg);
  const url = new URL(`${BASE_URL}/v2/calculate/tariff/delivery`);
  url.searchParams.set('object', String(object));
  url.searchParams.set('weight', String(weightGrams));
  url.searchParams.set('from', String(fromIndex));
  url.searchParams.set('to', String(toIndex));
  url.searchParams.set('pack', '10');
  url.searchParams.set('format', 'json');
  url.searchParams.set('errorcode', '1');

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const message = await safeText(response);
    throw new Error(`RUSPOST: не удалось рассчитать доставку. ${message}`.trim());
  }

  const data = await safeJson(response);
  const errors = extractApiErrors(data);
  if (errors) {
    throw new Error(`RUSPOST: ${errors}`);
  }

  const payKopeks = extractPayKopeks(data);
  if (!Number.isFinite(payKopeks) || payKopeks <= 0) {
    throw new Error('RUSPOST: API не вернул цену доставки.');
  }

  return {
    delivery_price: toRubles(payKopeks),
    delivery_currency: 'RUB',
    delivery_eta: formatEta(data),
    tariff_code: object ?? null,
    provider_metadata: data,
  };
}

export async function listTariffs(options) {
  try {
    const quote = await calculate(options);
    return [
      {
        tariff_code: quote.tariff_code ?? null,
        delivery_price: quote.delivery_price,
        delivery_currency: quote.delivery_currency ?? 'RUB',
        delivery_eta: quote.delivery_eta ?? null,
        provider_metadata: quote.provider_metadata ?? null,
      },
    ].filter((item) => Number.isFinite(Number(item.delivery_price)));
  } catch (error) {
    if (error instanceof Error && String(error.message).startsWith('RUSPOST:')) {
      return [];
    }
    throw error;
  }
}

function ensureConfigured() {
  requireEnv(originIndex, 'RUSPOST_ORIGIN_INDEX');
  requireEnv(objectCode, 'RUSPOST_OBJECT_CODE');
}

function normalizeAddress(raw) {
  const safe = raw && typeof raw === 'object' ? raw : {};
  return {
    region: typeof safe.region === 'string' ? safe.region.trim() : '',
    city: typeof safe.city === 'string' ? safe.city.trim() : '',
    postal_code: typeof safe.postal_code === 'string' ? safe.postal_code.trim() : '',
    street: typeof safe.street === 'string' ? safe.street.trim() : '',
    house: typeof safe.house === 'string' ? safe.house.trim() : '',
    flat: typeof safe.flat === 'string' ? safe.flat.trim() : '',
  };
}

function requireEnv(value, name) {
  const normalized = typeof value === 'string' ? value.trim() : value;
  if (!normalized) {
    throw new Error(`${name} не задан в окружении.`);
  }
  return normalized;
}

function normalizePostalIndex(value, field) {
  const raw = typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim();
  if (!raw) {
    throw new Error(`RUSPOST: ${field} обязателен для расчёта.`);
  }
  const digits = raw.replace(/\s+/g, '');
  if (!/^\d{5,6}$/.test(digits)) {
    throw new Error(`RUSPOST: некорректный почтовый индекс (${field}).`);
  }
  return digits;
}

function toWeightGrams(weightKg) {
  const weight = Number(weightKg);
  if (!Number.isFinite(weight) || weight <= 0) {
    throw new Error('RUSPOST: вес отправления обязателен.');
  }
  return Math.max(1, Math.ceil(weight * 1000));
}

function extractApiErrors(payload) {
  if (!payload || typeof payload !== 'object') {
    return 'некорректный ответ API.';
  }
  const errors = payload.errors;
  if (Array.isArray(errors) && errors.length) {
    return errors
      .map((item) => (item && typeof item === 'object' ? item.msg ?? item.message : String(item)))
      .filter(Boolean)
      .join('; ');
  }
  const message = payload.msg ?? payload.message ?? null;
  if (typeof message === 'string' && message.trim()) {
    return message.trim();
  }
  return '';
}

function extractPayKopeks(payload) {
  const candidates = [
    payload?.pay,
    payload?.paymoney,
    payload?.paynds,
    payload?.paymoneynds,
    payload?.ground?.val,
    payload?.items?.find?.((item) => item?.tariff?.val)?.tariff?.val,
  ];
  for (const value of candidates) {
    const numeric = typeof value === 'number' ? value : Number(value ?? NaN);
    if (Number.isFinite(numeric) && numeric > 0) {
      return numeric;
    }
  }
  return NaN;
}

function toRubles(kopeks) {
  const value = Number(kopeks);
  if (!Number.isFinite(value)) return NaN;
  return Number((value / 100).toFixed(2));
}

function formatEta(payload) {
  const delivery = payload?.delivery && typeof payload.delivery === 'object' ? payload.delivery : {};
  const min = Number(delivery.min ?? NaN);
  const max = Number(delivery.max ?? NaN);
  const deadlineRaw = typeof delivery.deadline === 'string' ? delivery.deadline : '';

  const parts = [];
  if (Number.isFinite(min) && Number.isFinite(max) && min > 0 && max > 0) {
    parts.push(min === max ? `${min} дн.` : `${min}-${max} дн.`);
  }

  const deadlineDate = parseCompactDate(deadlineRaw.slice(0, 8));
  if (deadlineDate) {
    parts.push(`до ${deadlineDate}`);
  }

  return parts.length ? parts.join(' ') : null;
}

function parseCompactDate(yyyymmdd) {
  if (!/^\d{8}$/.test(String(yyyymmdd))) return null;
  const s = String(yyyymmdd);
  const yyyy = s.slice(0, 4);
  const mm = s.slice(4, 6);
  const dd = s.slice(6, 8);
  return `${yyyy}-${mm}-${dd}`;
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch (error) {
    const text = await safeText(response);
    throw new Error(`RUSPOST: не удалось распарсить JSON. ${text}`.trim());
  }
}

async function safeText(response) {
  try {
    return await response.text();
  } catch (error) {
    return '';
  }
}
