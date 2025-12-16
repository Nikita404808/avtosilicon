const BASE_URL = process.env.RUSPOST_API_BASE || 'https://otpravka-api.pochta.ru';
const apiKey = process.env.RUSPOST_API_KEY;
const originIndex = process.env.RUSPOST_ORIGIN_INDEX;

export async function searchPvz({ query, city, lat, lon }) {
  ensureConfigured();
  // TODO: подключить реальный поиск ПВЗ Почты РФ. Ориентировочные эндпоинты:
  // - GET /1.0/postoffice/nearby?latitude={lat}&longitude={lon}&radius=...
  // - GET /1.0/postoffice/findbyaddress?address={query|city}
  // Потребуется заголовок Authorization: AccessToken <RUSPOST_API_KEY>.
  // Пока возвращаем пустой список, чтобы не блокировать фронт до интеграции.
  void query;
  void city;
  void lat;
  void lon;
  return [];
}

export async function calculate({ type, total_weight, pickup_point_id, address }) {
  ensureConfigured();
  const weightKg = Number(total_weight);
  if (!Number.isFinite(weightKg) || weightKg <= 0) {
    throw new Error('Почта РФ: вес обязателен для расчёта.');
  }
  if (!originIndex) {
    throw new Error('RUSPOST_ORIGIN_INDEX не задан в окружении.');
  }

  // TODO: заменить на реальный вызов Почты РФ:
  // предположительно POST /1.0/tariff или /1.0/delivery/confirm с полями:
  // { index-from: originIndex, index-to: <dest>, weight: <grams>, mail-category, mail-type }
  // Для режима Pvz нужно использовать индекс выбранного ПВЗ, для door — индекс адреса.
  // Заголовки: Authorization: AccessToken <RUSPOST_API_KEY>.
  const weightGrams = Math.max(1, Math.round(weightKg * 1000));
  const destinationIndex =
    type === 'pvz'
      ? String(pickup_point_id ?? '')
      : normalizeAddress(address).postal_code || '';

  if (!destinationIndex) {
    throw new Error('Почта РФ: не указан индекс получателя для расчёта.');
  }

  return {
    delivery_price: 0,
    delivery_currency: 'RUB',
    delivery_eta: null,
    tariff_code: null,
    provider_metadata: {
      todo: 'Подключить расчёт Почты РФ через официальный тарифный эндпоинт',
      weight_grams: weightGrams,
      index_from: originIndex,
      index_to: destinationIndex,
    },
  };
}

function ensureConfigured() {
  if (!apiKey) {
    throw new Error('RUSPOST_API_KEY не задан в окружении.');
  }
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
