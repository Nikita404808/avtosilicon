const BASE_URL = process.env.CDEK_API_URL || 'https://api.cdek.ru/v2';
const clientId = process.env.CDEK_CLIENT_ID;
const clientSecret = process.env.CDEK_CLIENT_SECRET;
const originCityCode = process.env.CDEK_ORIGIN_CITY_CODE;

let tokenCache = {
  accessToken: null,
  expiresAt: 0,
};

export async function searchPvz({ query, city, lat, lon }) {
  const cityCode = await resolveCityCode(query || city);
  if (!cityCode) {
    throw new Error('CDEK: не удалось определить город для поиска ПВЗ.');
  }
  const token = await getToken();
  const url = new URL(`${BASE_URL}/deliverypoints`);
  url.searchParams.set('city_code', cityCode);
  url.searchParams.set('type', 'PVZ');
  if (lat && lon) {
    url.searchParams.set('latitude', lat);
    url.searchParams.set('longitude', lon);
  }

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const message = await safeText(response);
    throw new Error(`CDEK: не удалось загрузить ПВЗ. ${message}`);
  }

  const payload = await response.json();
  if (!Array.isArray(payload)) {
    throw new Error('CDEK: некорректный ответ при поиске ПВЗ.');
  }

  return payload.map(normalizePoint).filter(Boolean);
}

export async function calculate(options) {
  const { type, total_weight, pickup_point_id, address, tariff_code: forcedTariffCode } = options ?? {};
  const weightKg = Number(total_weight);
  if (!Number.isFinite(weightKg) || weightKg <= 0) {
    throw new Error('CDEK: вес отправления обязателен.');
  }

  if (!originCityCode) {
    throw new Error('CDEK_ORIGIN_CITY_CODE не задан в окружении.');
  }

  const token = await getToken();
  const weightGrams = Math.max(1, Math.round(weightKg * 1000));
  const payload = {
    from_location: { code: originCityCode },
    packages: [{ weight: weightGrams }],
  };

  if (type === 'pvz') {
    if (!pickup_point_id) {
      throw new Error('CDEK: pickup_point_id обязателен для доставки в ПВЗ.');
    }
    const point = await fetchPointByCode(token, pickup_point_id);
    if (!point?.location?.city_code) {
      throw new Error('CDEK: не удалось определить город ПВЗ для расчёта.');
    }
    payload.to_location = { code: point.location.city_code };
    payload.delivery_point = pickup_point_id;
  } else {
    const toAddress = normalizeAddress(address);
    if (!toAddress.city) {
      throw new Error('CDEK: адрес доставки обязателен для режима \"до двери\".');
    }
    const cityCode = await resolveCityCode(toAddress.city);
    if (!cityCode) {
      throw new Error('CDEK: не удалось определить код города получателя.');
    }
    payload.to_location = {
      code: cityCode,
      address: `${toAddress.region}, ${toAddress.city}, ${toAddress.street} ${toAddress.house}${
        toAddress.flat ? `, кв. ${toAddress.flat}` : ''
      }`,
      postal_code: toAddress.postal_code,
    };
  }

  let selectedTariff = null;
  let appliedTariffCode = forcedTariffCode ?? null;

  if (!appliedTariffCode) {
    const tariffs = await listTariffs({
      type,
      total_weight: weightKg,
      pickup_point_id,
      address,
    });
    if (!tariffs.length) {
      throw new Error('CDEK: не удалось получить тарифы для расчёта.');
    }
    selectedTariff = tariffs.reduce((best, current) => {
      if (!best) return current;
      const currentPrice = Number(current.delivery_price ?? Infinity);
      const bestPrice = Number(best.delivery_price ?? Infinity);
      return currentPrice < bestPrice ? current : best;
    }, null);
    appliedTariffCode = selectedTariff?.tariff_code ?? null;
  }

  if (appliedTariffCode) {
    payload.tariff_code = appliedTariffCode;
  }

  const response = await fetch(`${BASE_URL}/calculator/tariff`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const message = await safeText(response);
    throw new Error(`CDEK: не удалось рассчитать доставку. ${message}`);
  }

  const data = await response.json();
  // TODO: уточнить поля ответа /calculator/tariff и сопоставление с delivery_price|eta|currency|tariff_code.
  const deliveryPrice =
    Number.isFinite(Number(data.total_sum))
      ? Number(data.total_sum)
      : Number.isFinite(Number(selectedTariff?.delivery_price))
        ? Number(selectedTariff?.delivery_price)
        : Number(data.price ?? data.delivery_sum ?? 0);
  const currency = data.currency ?? selectedTariff?.delivery_currency ?? 'RUB';
  const periodMin = data.period_min ?? data.period?.min ?? selectedTariff?.delivery_eta?.min;
  const periodMax = data.period_max ?? data.period?.max ?? selectedTariff?.delivery_eta?.max;
  const eta =
    Number.isFinite(periodMin) && Number.isFinite(periodMax)
      ? `${periodMin}-${periodMax} дн.`
      : selectedTariff?.delivery_eta ?? null;

  return {
    delivery_price: Math.max(0, deliveryPrice),
    delivery_currency: currency,
    delivery_eta: eta,
    tariff_code: data.tariff_code ?? appliedTariffCode ?? null,
    provider_metadata: data,
  };
}

export async function listTariffs({ type, total_weight, pickup_point_id, address }) {
  const weightKg = Number(total_weight);
  if (!Number.isFinite(weightKg) || weightKg <= 0) {
    throw new Error('CDEK: вес отправления обязателен.');
  }
  if (!originCityCode) {
    throw new Error('CDEK_ORIGIN_CITY_CODE не задан в окружении.');
  }

  const token = await getToken();
  const weightGrams = Math.max(1, Math.round(weightKg * 1000));
  const payload = {
    from_location: { code: originCityCode },
    packages: [{ weight: weightGrams }],
  };

  if (type === 'pvz') {
    if (!pickup_point_id) {
      throw new Error('CDEK: pickup_point_id обязателен для ПВЗ.');
    }
    const point = await fetchPointByCode(token, pickup_point_id);
    const cityCode = point?.location?.city_code;
    if (!cityCode) {
      throw new Error('Не удалось определить city_code получателя.');
    }
    payload.to_location = { code: cityCode };
    payload.delivery_point = pickup_point_id;
  } else {
    const toAddress = normalizeAddress(address);
    if (!toAddress.city) {
      throw new Error('CDEK: адрес доставки обязателен для режима "до двери".');
    }
    const cityCode = await resolveCityCode(toAddress.city);
    if (!cityCode) {
      throw new Error('Не удалось определить city_code получателя.');
    }
    payload.to_location = {
      code: cityCode,
      address: `${toAddress.region}, ${toAddress.city}, ${toAddress.street} ${toAddress.house}${
        toAddress.flat ? `, кв. ${toAddress.flat}` : ''
      }`,
      postal_code: toAddress.postal_code,
    };
  }

  const response = await fetch(`${BASE_URL}/calculator/tarifflist`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const message = await safeText(response);
    throw new Error(`CDEK: не удалось получить список тарифов. ${message}`);
  }

  const data = await response.json();
  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .map((item) => {
      const price = Number(item.total_sum ?? item.delivery_sum ?? item.price ?? 0);
      const periodMin = item.period_min ?? item.period?.min;
      const periodMax = item.period_max ?? item.period?.max;
      const eta =
        Number.isFinite(periodMin) && Number.isFinite(periodMax)
          ? `${periodMin}-${periodMax} дн.`
          : null;
      return {
        tariff_code: item.tariff_code ?? item.tariffCode ?? item.code ?? null,
        tariff_name: item.tariff_name ?? item.tariffName ?? item.title ?? null,
        delivery_price: Number.isFinite(price) ? price : null,
        delivery_currency: item.currency ?? 'RUB',
        delivery_eta: eta,
        raw: item,
      };
    })
    .filter((item) => item.tariff_code);
}

async function getToken() {
  if (tokenCache.accessToken && tokenCache.expiresAt - Date.now() > 60_000) {
    return tokenCache.accessToken;
  }

  if (!clientId || !clientSecret) {
    throw new Error('CDEK_CLIENT_ID и CDEK_CLIENT_SECRET должны быть заданы.');
  }

  const response = await fetch(`${BASE_URL}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!response.ok) {
    const message = await safeText(response);
    throw new Error(`CDEK OAuth: не удалось получить токен. ${message}`);
  }

  const payload = await response.json();
  const accessToken = payload.access_token;
  const expiresIn = Number(payload.expires_in ?? payload.expires_at ?? 0);
  tokenCache = {
    accessToken,
    expiresAt: Date.now() + Math.max(0, expiresIn) * 1000,
  };

  return accessToken;
}

async function resolveCityCode(cityQuery) {
  if (!cityQuery) return null;
  if (/^\d+$/.test(String(cityQuery))) return cityQuery;

  const token = await getToken();
  const url = new URL(`${BASE_URL}/location/cities`);
  url.searchParams.set('city', cityQuery);
  url.searchParams.set('size', '5');

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    return null;
  }
  const cities = await response.json();
  const match = Array.isArray(cities) ? cities[0] : null;
  return match?.code ?? null;
}

async function fetchPointByCode(token, code) {
  const url = new URL(`${BASE_URL}/deliverypoints`);
  url.searchParams.set('code', code);
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) return null;
  const points = await response.json();
  if (Array.isArray(points)) {
    return points.find((point) => point.code === code) ?? points[0] ?? null;
  }
  return null;
}

function normalizePoint(point) {
  if (!point) return null;
  const lat = point.location?.latitude ?? point.latitude ?? null;
  const lon = point.location?.longitude ?? point.longitude ?? null;
  return {
    id: point.code ?? point.id ?? point.uuid ?? null,
    name: point.name ?? point.location?.address ?? point.address ?? 'ПВЗ СДЭК',
    address: point.location?.address_full ?? point.location?.address ?? point.address ?? '',
    lat: lat === null ? undefined : Number(lat),
    lon: lon === null ? undefined : Number(lon),
  };
}

function normalizeAddress(raw) {
  const safe = raw && typeof raw === 'object' ? raw : {};
  return {
    region: stringOrEmpty(safe.region),
    city: stringOrEmpty(safe.city),
    postal_code: stringOrEmpty(safe.postal_code),
    street: stringOrEmpty(safe.street),
    house: stringOrEmpty(safe.house),
    flat: stringOrEmpty(safe.flat),
  };
}

function stringOrEmpty(value) {
  return typeof value === 'string' ? value.trim() : '';
}

async function safeText(response) {
  try {
    return await response.text();
  } catch (error) {
    return '';
  }
}
