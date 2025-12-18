const BASE_URL = process.env.RUSPOST_API_BASE || 'https://tariff.pochta.ru';
const officeIndex = process.env.RUSPOST_OFFICE_INDEX;
const acceptanceIndex = process.env.RUSPOST_ACCEPTANCE_INDEX;
const objectCode = process.env.RUSPOST_OBJECT_CODE;
const isDev = process.env.NODE_ENV !== 'production';

export async function searchPvz({ query, city, lat, lon }) {
  const normalizedCity = typeof city === 'string' ? city.trim() : '';
  const normalizedQuery = typeof query === 'string' ? query.trim() : '';
  const fallbackLat = normalizeCoordinate(lat);
  const fallbackLon = normalizeCoordinate(lon);

  const geocodeQuery = [normalizedCity, normalizedQuery].filter(Boolean).join(', ').trim();
  const bounds =
    (geocodeQuery ? await resolveBoundsByQuery(geocodeQuery) : null) ??
    (fallbackLat != null && fallbackLon != null
      ? boundsAroundPoint(fallbackLat, fallbackLon)
      : null);

  if (!bounds) {
    throw new Error('RUSPOST: не удалось определить координаты для поиска отделений.');
  }

  const points = await fetchOfficesFromRectangle(bounds);
  const filteredByQuery = applyTextFilter(points, normalizedQuery);
  const cityFiltered =
    normalizedCity && normalizedCity !== normalizedQuery
      ? applyTextFilter(filteredByQuery.length ? filteredByQuery : points, normalizedCity)
      : [];
  const filtered = cityFiltered.length ? cityFiltered : filteredByQuery;
  return filtered.slice(0, 50);
}

export async function calculate({
  provider,
  type,
  total_weight,
  pickup_point_id,
  address,
  provider_metadata,
}) {
  void provider;
  void provider_metadata;

  const weightKg = Number(total_weight);
  if (!Number.isFinite(weightKg) || weightKg <= 0) {
    throw new Error('RUSPOST: вес отправления обязателен.');
  }

  const office = normalizeEnvPostalIndexOptional(officeIndex);
  const acceptance = requireAcceptanceIndex();
  const fromIndex = acceptance;
  const object = requireEnv(objectCode, 'RUSPOST_OBJECT_CODE');

  const toIndex =
    type === 'pvz'
      ? normalizePostalIndex(pickup_point_id, 'pickup_point_id')
      : normalizePostalIndex(normalizeAddress(address).postal_code, 'address.postal_code');

  if (isDev) {
    console.log('RUSPOST: indexes', { office, acceptance, from: fromIndex, to: toIndex });
  }

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
  const apiErrors = extractApiErrors(data);
  if (apiErrors.length) {
    const acceptanceError = apiErrors.find((item) => item?.code === 2004);
    if (acceptanceError) {
      const error = new Error(
        'RUSPOST: from-index is not in acceptance list (code 2004). Check RUSPOST_ACCEPTANCE_INDEX',
      );
      error.error_code = 2004;
      error.detail = { code: acceptanceError.code, msg: acceptanceError.msg, errors: apiErrors };
      throw error;
    }

    const message = apiErrors
      .map((item) => item?.msg)
      .filter(Boolean)
      .join('; ');
    const error = new Error(`RUSPOST: ${message || 'ошибка API.'}`);
    const firstCode = apiErrors.find((item) => item?.code != null)?.code ?? null;
    if (firstCode != null) {
      error.error_code = firstCode;
    }
    error.detail = { errors: apiErrors };
    throw error;
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
    provider_metadata: {
      ...data,
      _local: { office, acceptance, from: fromIndex, to: toIndex },
    },
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

function requireAcceptanceIndex() {
  const raw = typeof acceptanceIndex === 'string' ? acceptanceIndex.trim() : acceptanceIndex;
  if (!raw) {
    throw new Error(
      'RUSPOST_ACCEPTANCE_INDEX отсутствует. Укажите индекс места приёма (например 413840).',
    );
  }

  const digits = String(raw).replace(/\s+/g, '');
  if (!/^\d{5,6}$/.test(digits)) {
    throw new Error(
      'RUSPOST_ACCEPTANCE_INDEX некорректен. Укажите индекс места приёма числом (например 413840).',
    );
  }
  return digits;
}

function normalizeEnvPostalIndexOptional(value) {
  const raw = typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim();
  if (!raw) return null;
  const digits = raw.replace(/\s+/g, '');
  return /^\d{5,6}$/.test(digits) ? digits : null;
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
  const normalized = [];

  if (!payload || typeof payload !== 'object') {
    return [{ code: null, msg: 'некорректный ответ API.' }];
  }

  const errors = payload.errors;
  if (Array.isArray(errors) && errors.length) {
    for (const item of errors) {
      if (item && typeof item === 'object') {
        const msg = (item.msg ?? item.message ?? '').toString().trim();
        normalized.push({ code: resolveErrorCode(item), msg: msg || 'ошибка API.' });
      } else if (item != null) {
        normalized.push({ code: null, msg: String(item) });
      }
    }
    return normalized.filter((item) => item.msg);
  }

  const message = payload.msg ?? payload.message ?? null;
  if (typeof message === 'string' && message.trim()) {
    return [{ code: resolveErrorCode(payload), msg: message.trim() }];
  }
  return [];
}

function resolveErrorCode(value) {
  if (!value || typeof value !== 'object') return null;
  const candidate = value.code ?? value.error_code ?? value.errorCode ?? null;
  if (candidate == null) return null;
  const numeric = typeof candidate === 'number' ? candidate : Number(String(candidate).trim());
  return Number.isFinite(numeric) ? numeric : null;
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

function normalizeCoordinate(value) {
  if (value == null) return null;
  const numeric = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isFinite(numeric)) return null;
  return numeric;
}

function boundsAroundPoint(lat, lon, delta = 0.25) {
  const safeDelta = Number.isFinite(delta) && delta > 0 ? delta : 0.25;
  const north = clampLatitude(lat + safeDelta);
  const south = clampLatitude(lat - safeDelta);
  const west = clampLongitude(lon - safeDelta);
  const east = clampLongitude(lon + safeDelta);
  return {
    topLeftPoint: { latitude: north, longitude: west },
    bottomRightPoint: { latitude: south, longitude: east },
  };
}

function clampLatitude(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(-90, Math.min(90, numeric));
}

function clampLongitude(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(-180, Math.min(180, numeric));
}

async function resolveBoundsByQuery(query) {
  const text = typeof query === 'string' ? query.trim() : '';
  if (!text) return null;

  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');
  url.searchParams.set('countrycodes', 'ru');
  url.searchParams.set('q', text);

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'auto-silicone.ru (ruspost pvz search)',
    },
  });
  if (!response.ok) return null;

  const data = await response.json();
  const first = Array.isArray(data) ? data[0] : null;
  const bbox = Array.isArray(first?.boundingbox) ? first.boundingbox : null;
  if (!bbox || bbox.length < 4) return null;

  const south = Number(bbox[0]);
  const north = Number(bbox[1]);
  const west = Number(bbox[2]);
  const east = Number(bbox[3]);
  if (![south, north, west, east].every((v) => Number.isFinite(v))) return null;

  return {
    topLeftPoint: { latitude: clampLatitude(north), longitude: clampLongitude(west) },
    bottomRightPoint: { latitude: clampLatitude(south), longitude: clampLongitude(east) },
  };
}

async function fetchOfficesFromRectangle(bounds) {
  const url = new URL('https://www.pochta.ru/suggestions/v2/postoffices.find-from-rectangle');
  const payload = {
    ...bounds,
    precision: 0,
    onlyCoordinate: false,
    offset: 0,
    limit: 100,
    extFilters: ['OPS', 'NOT_TEMPORARY_CLOSED', 'NOT_PRIVATE', 'NOT_CLOSED', 'ONLY_ATI'],
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const message = await safeText(response);
    throw new Error(`RUSPOST: не удалось загрузить отделения. ${message}`.trim());
  }

  const data = await safeJson(response);
  const offices = Array.isArray(data?.postOffices) ? data.postOffices : [];
  return offices.map(normalizeOffice).filter(Boolean);
}

function normalizeOffice(office) {
  if (!office || typeof office !== 'object') return null;
  const rawPostalCode = office.postalCode ?? office.postal_code ?? office.index ?? '';
  const postalCode = String(rawPostalCode).trim();
  if (!/^\d{5,6}$/.test(postalCode)) return null;

  const address = office.address && typeof office.address === 'object' ? office.address : {};
  const cityType = typeof address.settlementTypeOrCityType === 'string' ? address.settlementTypeOrCityType.trim() : '';
  const cityName = typeof address.settlementOrCity === 'string' ? address.settlementOrCity.trim() : '';
  const cityLabel = [cityType, cityName].filter(Boolean).join(' ').trim();

  const addressSource =
    typeof office.addressSource === 'string'
      ? office.addressSource.trim()
      : typeof address.shortAddress === 'string'
        ? address.shortAddress.trim()
        : typeof address.fullAddress === 'string'
          ? address.fullAddress.trim()
          : '';

  const fullAddress = [cityLabel || null, addressSource || null].filter(Boolean).join(', ');
  const lat = normalizeCoordinate(office.latitude ?? office.lat);
  const lon = normalizeCoordinate(office.longitude ?? office.lon ?? office.lng);

  return {
    id: postalCode,
    name: `${postalCode} — ${fullAddress || 'Отделение Почты России'}`,
    address: fullAddress || addressSource || '',
    lat: lat == null ? undefined : lat,
    lon: lon == null ? undefined : lon,
  };
}

function applyTextFilter(points, query) {
  const q = typeof query === 'string' ? query.trim().toLowerCase() : '';
  if (!q) return points;

  return (Array.isArray(points) ? points : []).filter((point) => {
    const haystack = `${point?.id ?? ''} ${point?.name ?? ''} ${point?.address ?? ''}`.toLowerCase();
    return haystack.includes(q);
  });
}
