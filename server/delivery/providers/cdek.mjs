const BASE_URL = process.env.CDEK_API_URL || 'https://api.cdek.ru/v2';
const clientId = process.env.CDEK_CLIENT_ID;
const clientSecret = process.env.CDEK_CLIENT_SECRET;
const originCityCode = process.env.CDEK_ORIGIN_CITY_CODE;
const senderName = process.env.CDEK_SENDER_NAME || 'Avtosilicon';
const senderPhone = process.env.CDEK_SENDER_PHONE || '+79000000000';
const senderEmail = process.env.CDEK_SENDER_EMAIL || null;
const defaultPackageLength = Number(process.env.CDEK_DEFAULT_LENGTH ?? 10);
const defaultPackageWidth = Number(process.env.CDEK_DEFAULT_WIDTH ?? 10);
const defaultPackageHeight = Number(process.env.CDEK_DEFAULT_HEIGHT ?? 10);
const defaultTariffPvz = Number(process.env.CDEK_DEFAULT_TARIFF_PVZ ?? 136);
const defaultTariffDoor = Number(process.env.CDEK_DEFAULT_TARIFF_DOOR ?? 137);

let tokenCache = {
  accessToken: null,
  expiresAt: 0,
};

export async function searchPvz({ query, city, lat, lon, mode }) {
  const cityCode = await resolveCityCode(query || city);
  if (!cityCode) {
    throw new Error('CDEK: не удалось определить город для поиска ПВЗ.');
  }
  const token = await getToken();
  const points = await fetchDeliveryPointsList({
    token,
    cityCode,
    lat,
    lon,
    types: ['PVZ', 'POSTAMAT'],
  });

  const searchMode = normalizePvzMode(mode);
  const raw = Array.isArray(points) ? points : [];

  logCdekPvzSamplesIfEnabled(raw);

  const filtered = raw.filter((point) => {
    const { canPickup, canDropoff } = getCdekPointCapabilities(point);
    if (searchMode === 'send') return canDropoff;
    return canPickup;
  });

  // Желательно: сначала PVZ, потом POSTAMAT
  filtered.sort((a, b) => {
    const aPostamat = getCdekPointCapabilities(a).isPostamat;
    const bPostamat = getCdekPointCapabilities(b).isPostamat;
    if (aPostamat === bPostamat) return 0;
    return aPostamat ? 1 : -1;
  });

  const normalized = filtered.map(normalizePoint).filter(Boolean);

  return normalized;
}

export async function calculate(options) {
  const {
    type,
    total_weight,
    pickup_point_id,
    address,
    provider_metadata,
    tariff_code: forcedTariffCode,
  } = options ?? {};
  const weightKg = Number(total_weight);
  if (!Number.isFinite(weightKg) || weightKg <= 0) {
    throw new Error('CDEK: вес отправления обязателен.');
  }

  const tariffs = await listTariffs({
    type,
    total_weight: weightKg,
    pickup_point_id,
    address,
    provider_metadata,
  });
  if (!tariffs.length) {
    throw new Error('CDEK: не удалось получить тарифы для расчёта.');
  }

  const forced = forcedTariffCode
    ? tariffs.find((tariff) => String(tariff.tariff_code) === String(forcedTariffCode))
    : null;
  const cheapest = tariffs.reduce((best, current) => {
    const currentPrice = Number(current.delivery_price ?? Infinity);
    const bestPrice = Number(best?.delivery_price ?? Infinity);
    if (!Number.isFinite(currentPrice)) return best;
    if (!best || currentPrice < bestPrice) return current;
    return best;
  }, null);

  const selectedTariff = forced ?? cheapest ?? tariffs[0];
  if (!selectedTariff?.tariff_code) {
    throw new Error('CDEK: не удалось выбрать тариф для расчёта.');
  }

  return {
    delivery_price: Number(selectedTariff.delivery_price),
    delivery_currency: selectedTariff.delivery_currency ?? 'RUB',
    delivery_eta: selectedTariff.delivery_eta ?? null,
    tariff_code: selectedTariff.tariff_code,
    provider_metadata: selectedTariff.provider_metadata ?? null,
  };
}

export async function listTariffs({ type, total_weight, pickup_point_id, address, provider_metadata }) {
  const weightKg = Number(total_weight);
  if (!Number.isFinite(weightKg) || weightKg <= 0) {
    throw new Error('CDEK: вес отправления обязателен.');
  }
  const originCityCodeNumber = resolveRequiredCityCode(originCityCode, 'CDEK_ORIGIN_CITY_CODE');

  const token = await getToken();
  const weightGrams = toWeightGrams(weightKg);
  const payload = {
    from_location: { city_code: originCityCodeNumber, code: originCityCodeNumber },
    packages: [{ weight: weightGrams }],
  };

  if (type === 'pvz') {
    if (!pickup_point_id) {
      throw new Error('CDEK: pickup_point_id обязателен для ПВЗ.');
    }
    const toCityCode = provider_metadata?.to_city_code;
    if (!toCityCode) {
      throw new Error(
        'to_city_code обязателен для расчёта PVZ (выберите ПВЗ заново)',
      );
    }
    const toCityCodeNumber = resolveRequiredCityCode(toCityCode, 'to_city_code');
    payload.to_location = { city_code: toCityCodeNumber, code: toCityCodeNumber };
    payload.delivery_point = pickup_point_id;
  } else {
    const toAddress = normalizeAddress(address);
    const toCityCode =
      provider_metadata?.to_city_code ??
      (await resolveCityCodeByAddress(toAddress));
    if (!toCityCode) {
      throw new Error('Не удалось определить город доставки');
    }
    if (!toAddress.city) {
      throw new Error('CDEK: адрес доставки обязателен для режима "до двери".');
    }
    const toCityCodeNumber = resolveRequiredCityCode(toCityCode, 'to_city_code');
    payload.to_location = {
      city_code: toCityCodeNumber,
      code: toCityCodeNumber,
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
  const list = Array.isArray(data?.tariff_codes)
    ? data.tariff_codes
    : Array.isArray(data?.tariffs)
      ? data.tariffs
      : [];

  return list
    .map((item) => {
      const price = Number(item.delivery_sum);
      const periodMin = item.period_min;
      const periodMax = item.period_max;
      const eta =
        Number.isFinite(periodMin) && Number.isFinite(periodMax)
          ? `${periodMin}-${periodMax} дн.`
          : null;
      return {
        tariff_code: item.tariff_code ?? null,
        delivery_price: Number.isFinite(price) ? price : null,
        delivery_currency: 'RUB',
        delivery_eta: eta,
        provider_metadata: item,
      };
    })
    .filter((item) => item.tariff_code && Number.isFinite(Number(item.delivery_price)));
}

export async function createShipment(options) {
  const {
    order_id,
    order_number,
    type,
    total_weight,
    pickup_point_id,
    address,
    recipient,
    tariff_code,
    provider_metadata,
    items,
    comment,
  } = options ?? {};

  const token = await getToken();
  const originCityCodeNumber = resolveRequiredCityCode(originCityCode, 'CDEK_ORIGIN_CITY_CODE');
  const normalizedType = type === 'door' ? 'door' : 'pvz';
  const normalizedRecipient = normalizeRecipient(recipient);

  const toLocation = await resolveDestination({
    token,
    type: normalizedType,
    pickupPointId: pickup_point_id,
    address,
    providerMetadata: provider_metadata,
  });

  const number = sanitizeShipmentNumber(
    order_number ? String(order_number) : `AS-${String(order_id ?? Date.now())}`,
  );
  const payload = {
    type: 1,
    number,
    tariff_code: resolveTariffCode(tariff_code, normalizedType),
    comment: stringOrEmpty(comment) || undefined,
    sender: {
      name: senderName,
      phones: [{ number: normalizePhone(senderPhone) }],
      ...(senderEmail ? { email: senderEmail } : {}),
    },
    recipient: normalizedRecipient,
    from_location: {
      city_code: originCityCodeNumber,
      code: originCityCodeNumber,
    },
    to_location: toLocation,
    packages: [
      {
        number: `${number}-1`,
        weight: toWeightGrams(total_weight),
        length: normalizeDimension(defaultPackageLength),
        width: normalizeDimension(defaultPackageWidth),
        height: normalizeDimension(defaultPackageHeight),
        ...(Array.isArray(items) && items.length ? { items: normalizeItems(items) } : {}),
      },
    ],
    ...(normalizedType === 'pvz' && pickup_point_id ? { delivery_point: String(pickup_point_id) } : {}),
  };

  let result = await submitOrder(token, payload);
  // Some CDEK accounts reject pvz payload when to_location is combined with delivery_point.
  if (!result.ok && normalizedType === 'pvz' && hasCdekErrorCode(result.body, 'v2_delivery_address_multivalued')) {
    const retryPayload = { ...payload };
    delete retryPayload.to_location;
    result = await submitOrder(token, retryPayload);
  }
  if (!result.ok) {
    const message = result.body?.message ?? result.text ?? `HTTP ${result.status}`;
    throw new Error(`CDEK: не удалось создать отправление. ${message}`);
  }
  const body = result.body;

  const providerOrderId =
    body?.entity?.uuid ??
    body?.entity?.cdek_number ??
    body?.requests?.[0]?.request_uuid ??
    body?.request_uuid ??
    null;
  const trackNumber = body?.entity?.cdek_number ?? body?.entity?.barcode ?? null;

  return {
    provider_order_id: providerOrderId ? String(providerOrderId) : null,
    track_number: trackNumber ? String(trackNumber) : null,
    payload,
    response: body ?? text ?? null,
  };
}

async function submitOrder(token, payload) {
  const response = await fetch(`${BASE_URL}/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const text = await safeText(response);
  const body = parseJson(text);
  return {
    ok: response.ok,
    status: response.status,
    text,
    body,
  };
}

function hasCdekErrorCode(payload, code) {
  const list = Array.isArray(payload?.requests) ? payload.requests : [];
  for (const request of list) {
    const errors = Array.isArray(request?.errors) ? request.errors : [];
    for (const item of errors) {
      if (String(item?.code ?? '').trim() === String(code)) {
        return true;
      }
    }
  }
  return false;
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
  const normalized = String(cityQuery).trim();
  if (/^\d{5,6}$/.test(normalized)) {
    const byPostal = await resolveCityCodeByPostal(normalized);
    if (byPostal) return byPostal;
  }
  if (/^\d+$/.test(normalized)) return normalized;

  const token = await getToken();
  const url = new URL(`${BASE_URL}/location/cities`);
  url.searchParams.set('city', normalized);
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

async function resolveDestination({ token, type, pickupPointId, address, providerMetadata }) {
  if (type === 'pvz') {
    if (!pickupPointId) {
      throw new Error('CDEK: pickup_point_id обязателен для отправки в ПВЗ.');
    }
    const point = await fetchPointByCode(token, String(pickupPointId));
    if (!point) {
      throw new Error('CDEK: не удалось получить данные выбранного ПВЗ.');
    }
    const pointCityCode =
      point?.location?.city_code ??
      point?.location?.cityCode ??
      providerMetadata?.to_city_code ??
      null;
    const toCityCodeNumber = resolveRequiredCityCode(pointCityCode, 'to_city_code');
    return {
      city_code: toCityCodeNumber,
      code: toCityCodeNumber,
    };
  }

  const toAddress = normalizeAddress(address);
  const toCityCode =
    providerMetadata?.to_city_code ??
    (await resolveCityCodeByAddress(toAddress));
  if (!toCityCode) {
    throw new Error('CDEK: не удалось определить город получателя.');
  }
  const toCityCodeNumber = resolveRequiredCityCode(toCityCode, 'to_city_code');
  return {
    city_code: toCityCodeNumber,
    code: toCityCodeNumber,
    address: buildAddressLine(toAddress),
  };
}

async function resolveCityCodeByPostal(postalCode) {
  const token = await getToken();
  const url = new URL(`${BASE_URL}/location/cities`);
  url.searchParams.set('postal_code', postalCode);
  url.searchParams.set('size', '1');

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
  const { isPostamat } = getCdekPointCapabilities(point);
  const lat = point.location?.latitude ?? point.latitude ?? null;
  const lon = point.location?.longitude ?? point.longitude ?? null;
  const cityCode = point.location?.city_code ?? point.location?.cityCode ?? point.city_code ?? null;
  const rawName = point.name ?? point.location?.address ?? point.address ?? 'ПВЗ СДЭК';
  const name = isPostamat ? `${rawName} (Постамат)` : rawName;
  return {
    id: point.code ?? point.id ?? point.uuid ?? null,
    name,
    address: point.location?.address_full ?? point.location?.address ?? point.address ?? '',
    city_code: cityCode === null ? undefined : String(cityCode),
    lat: lat === null ? undefined : Number(lat),
    lon: lon === null ? undefined : Number(lon),
  };
}

function normalizePvzMode(value) {
  const mode = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (mode === 'send') return 'send';
  return 'pickup';
}

async function fetchDeliveryPointsList({ token, cityCode, lat, lon, types }) {
  const list = [];
  const seen = new Set();
  const typesList = Array.isArray(types) && types.length ? types : [null];

  for (const type of typesList) {
    const url = new URL(`${BASE_URL}/deliverypoints`);
    url.searchParams.set('city_code', cityCode);
    if (type) url.searchParams.set('type', type);
    if (lat != null && lon != null && lat !== '' && lon !== '') {
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
      if (type && typesList.length > 1) {
        if (String(process.env.DEBUG_CDEK_PVZ ?? '') === '1') {
          console.log('CDEK PVZ DEBUG: failed to fetch type', { type, status: response.status, message });
        }
        continue;
      }
      throw new Error(`CDEK: не удалось загрузить ПВЗ. ${message}`);
    }

    const payload = await response.json();
    if (!Array.isArray(payload)) {
      throw new Error('CDEK: некорректный ответ при поиске ПВЗ.');
    }

    for (const point of payload) {
      const id = point?.code ?? point?.id ?? point?.uuid ?? null;
      const key = id == null ? null : String(id);
      if (key && seen.has(key)) continue;
      if (key) seen.add(key);
      list.push(point);
    }
  }

  return list;
}

function getCdekPointCapabilities(point) {
  const typeCandidate = [
    point?.type,
    point?.office_type,
    point?.officeType,
    point?.point_type,
    point?.pointType,
  ]
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .find(Boolean);
  const normalizedType = typeCandidate ? typeCandidate.toUpperCase() : '';

  const isPostamat = normalizedType === 'POSTAMAT';

  const { pickupSignal, dropoffSignal } = extractOperationSignals(point);

  const fallbackPickupByType = normalizedType === 'PVZ' || normalizedType === 'POSTAMAT';

  const canPickup = pickupSignal ?? fallbackPickupByType;
  const canDropoff = dropoffSignal ?? false;

  return { canPickup: Boolean(canPickup), canDropoff: Boolean(canDropoff), isPostamat };
}

function extractOperationSignals(point) {
  const pickupRegex = /(handout|issue|pickup|выдач|получ)/i;
  const dropoffRegex = /(accept|dropoff|take|receive|прием|отправ)/i;

  const pickupVotes = [];
  const dropoffVotes = [];

  const pushVote = (votes, value) => {
    if (value === true || value === false) votes.push(value);
  };

  const scanPrimitive = (value) => {
    if (typeof value === 'string') {
      if (pickupRegex.test(value)) pickupVotes.push(true);
      if (dropoffRegex.test(value)) dropoffVotes.push(true);
    }
    if (typeof value === 'number') {
      // Числовые коды без документации не интерпретируем.
    }
  };

  const scanObjectKeys = (obj, { scanValues } = {}) => {
    if (!obj || typeof obj !== 'object') return;
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'boolean') {
        if (pickupRegex.test(key)) pushVote(pickupVotes, value);
        if (dropoffRegex.test(key)) pushVote(dropoffVotes, value);
      } else if (scanValues && (typeof value === 'string' || typeof value === 'number')) {
        scanPrimitive(value);
      }
    }
  };

  const candidates = [
    point?.allowed_operation,
    point?.allowed_operations,
    point?.operations,
    point?.operation,
    point?.services,
    point?.service,
  ];

  for (const value of candidates) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item && typeof item === 'object') {
          scanObjectKeys(item, { scanValues: true });
          scanPrimitive(item.code);
          scanPrimitive(item.name);
          scanPrimitive(item.type);
          scanPrimitive(item.operation);
        } else {
          scanPrimitive(item);
        }
      }
      continue;
    }
    if (value && typeof value === 'object') {
      scanObjectKeys(value, { scanValues: true });
      continue;
    }
    scanPrimitive(value);
  }

  // Популярные флаги (без зависимости от конкретного набора полей).
  scanObjectKeys(point, { scanValues: false });

  const pickupSignal = pickupVotes.includes(true)
    ? true
    : pickupVotes.includes(false)
      ? false
      : null;
  const dropoffSignal = dropoffVotes.includes(true)
    ? true
    : dropoffVotes.includes(false)
      ? false
      : null;

  return { pickupSignal, dropoffSignal };
}

function logCdekPvzSamplesIfEnabled(points) {
  if (String(process.env.DEBUG_CDEK_PVZ ?? '') !== '1') return;
  if (!Array.isArray(points) || !points.length) return;

  const bucket = {
    pickupOnly: [],
    pickupAndDropoff: [],
    other: [],
  };

  for (const point of points) {
    const { canPickup, canDropoff } = getCdekPointCapabilities(point);
    if (canPickup && !canDropoff) bucket.pickupOnly.push(point);
    else if (canPickup && canDropoff) bucket.pickupAndDropoff.push(point);
    else bucket.other.push(point);
  }

  const pickFields = (point) => {
    const fields = {
      code: point?.code ?? null,
      name: point?.name ?? null,
      type: point?.type ?? point?.office_type ?? point?.officeType ?? null,
      allowed_operation: point?.allowed_operation ?? point?.allowed_operations ?? null,
      services: point?.services ?? null,
      capabilities: getCdekPointCapabilities(point),
    };
    // Чтобы лог был компактным и безопасным.
    if (Array.isArray(fields.allowed_operation) && fields.allowed_operation.length > 10) {
      fields.allowed_operation = fields.allowed_operation.slice(0, 10);
    }
    if (Array.isArray(fields.services) && fields.services.length > 10) {
      fields.services = fields.services.slice(0, 10);
    }
    return fields;
  };

  const logSamples = (title, list) => {
    const samples = list.slice(0, 2).map(pickFields);
    if (!samples.length) return;
    console.log(`CDEK PVZ DEBUG: ${title} samples:`, samples);
  };

  console.log('CDEK PVZ DEBUG: counts', {
    total: points.length,
    pickupOnly: bucket.pickupOnly.length,
    pickupAndDropoff: bucket.pickupAndDropoff.length,
    other: bucket.other.length,
  });

  const listCodes = (list) =>
    list
      .slice(0, 5)
      .map((point) => `${point?.code ?? 'unknown'}:${String(point?.name ?? '').slice(0, 80)}`);

  console.log('CDEK PVZ DEBUG: codes', {
    pickupOnly: listCodes(bucket.pickupOnly),
    pickupAndDropoff: listCodes(bucket.pickupAndDropoff),
    other: listCodes(bucket.other),
  });

  logSamples('pickup-only', bucket.pickupOnly);
  logSamples('pickup+dropoff', bucket.pickupAndDropoff);
  logSamples('non-pickup', bucket.other);
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

function buildAddressLine(address) {
  const parts = [address.city, address.street, address.house, address.flat ? `кв. ${address.flat}` : '']
    .map((part) => stringOrEmpty(part))
    .filter(Boolean);
  return parts.join(', ');
}

function normalizeRecipient(raw) {
  const safe = raw && typeof raw === 'object' ? raw : {};
  const name = stringOrEmpty(safe.full_name) || stringOrEmpty(safe.name) || 'Получатель';
  const phone = normalizePhone(safe.phone);
  const email = stringOrEmpty(safe.email);
  return {
    name,
    phones: [{ number: phone }],
    ...(email ? { email } : {}),
  };
}

function normalizePhone(value) {
  const raw = typeof value === 'string' ? value : value == null ? '' : String(value);
  const normalized = raw.replace(/[^\d+]/g, '');
  if (!normalized) return '+79000000000';
  if (normalized.startsWith('+')) return normalized;
  return `+${normalized}`;
}

function normalizeDimension(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return 10;
  return Math.ceil(numeric);
}

function normalizeItems(items) {
  const list = items
    .map((item, index) => {
      const quantity = Number(item?.quantity);
      const amount = Number(item?.price);
      const name = stringOrEmpty(item?.title) || stringOrEmpty(item?.name) || `Товар ${index + 1}`;
      return {
        name,
        ware_key: String(item?.productId ?? item?.id ?? index + 1),
        payment: {
          value: Number.isFinite(amount) && amount >= 0 ? Math.round(amount) : 0,
        },
        cost: Number.isFinite(amount) && amount >= 0 ? Math.round(amount) : 0,
        amount: Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 1,
        weight: 1,
      };
    })
    .filter(Boolean);
  return list;
}

function resolveTariffCode(value, type) {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) return Math.floor(numeric);
  const fallback = type === 'pvz' ? defaultTariffPvz : defaultTariffDoor;
  if (!Number.isFinite(fallback) || fallback <= 0) {
    throw new Error('CDEK: не удалось определить tariff_code для отправления.');
  }
  return Math.floor(fallback);
}

function sanitizeShipmentNumber(value) {
  const sanitized = String(value ?? '')
    .trim()
    .replace(/[^0-9A-Za-z_-]/g, '-')
    .slice(0, 40);
  if (!sanitized) return `AS-${Date.now()}`;
  return sanitized;
}

function toWeightGrams(weightKg) {
  const weight = Number(weightKg);
  if (!Number.isFinite(weight) || weight <= 0) {
    throw new Error('CDEK: вес отправления обязателен.');
  }
  return Math.max(1, Math.ceil(weight * 1000));
}

function resolveRequiredCityCode(value, fieldName) {
  const raw = typeof value === 'string' ? value.trim() : value;
  const numeric = typeof raw === 'number' ? raw : Number(raw ?? NaN);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new Error(`${fieldName} обязателен для расчёта доставки.`);
  }
  return Number(numeric);
}

async function resolveCityCodeByAddress(address) {
  const toAddress = normalizeAddress(address);
  const token = await getToken();

  const tryFetch = async (params) => {
    const url = new URL(`${BASE_URL}/location/cities`);
    Object.entries(params).forEach(([key, value]) => {
      if (value) {
        url.searchParams.set(key, String(value));
      }
    });
    url.searchParams.set('size', '5');
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) return null;
    const cities = await response.json();
    const match = Array.isArray(cities) ? cities[0] : null;
    const code = match?.code ?? null;
    return code ? String(code) : null;
  };

  if (toAddress.postal_code) {
    const byPostal =
      (await tryFetch({ postal_code: toAddress.postal_code })) ??
      (await tryFetch({ post_code: toAddress.postal_code }));
    if (byPostal) return byPostal;
  }

  if (toAddress.city) {
    const byCity =
      (await tryFetch({ city: toAddress.city, region: toAddress.region })) ??
      (await tryFetch({ city: toAddress.city }));
    if (byCity) return byCity;
  }

  return null;
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

function parseJson(value) {
  if (!value || typeof value !== 'string') return null;
  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
}
