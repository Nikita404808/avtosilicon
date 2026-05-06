import { randomUUID } from 'node:crypto';

const API_BASE = process.env.YANDEX_DELIVERY_API_BASE || 'https://b2b.taxi.yandex.net';
const OTHER_DAY_API_BASE =
  process.env.YANDEX_DELIVERY_OTHER_DAY_API_BASE || 'https://b2b-authproxy.taxi.yandex.net';
const apiToken = process.env.YANDEX_DELIVERY_TOKEN || process.env.YANDEX_DELIVERY_API_KEY || '';
const apiClientId = String(process.env.YANDEX_DELIVERY_CLIENT_ID || '').trim();
const apiModeRaw = String(process.env.YANDEX_DELIVERY_API_MODE || '').trim().toLowerCase();
const otherDaySourceStationId = String(process.env.YANDEX_DELIVERY_PLATFORM_STATION_ID || '').trim();
const otherDayMerchantId = String(process.env.YANDEX_DELIVERY_MERCHANT_ID || '').trim();
let cachedResolvedSourceStationId = '';

const pickupAddress = String(process.env.YANDEX_DELIVERY_PICKUP_ADDRESS || '').trim();
const pickupLat = toNumber(process.env.YANDEX_DELIVERY_PICKUP_LAT);
const pickupLon = toNumber(process.env.YANDEX_DELIVERY_PICKUP_LON);
const pickupContactName = String(process.env.YANDEX_DELIVERY_PICKUP_CONTACT_NAME || 'Avtosilicon').trim();
const pickupContactPhone = String(process.env.YANDEX_DELIVERY_PICKUP_CONTACT_PHONE || '+79000000000').trim();
const pickupContactEmail = String(
  process.env.YANDEX_DELIVERY_PICKUP_CONTACT_EMAIL ||
    process.env.SMTP_USER ||
    'noreply@avtosilicon.ru',
).trim();

const callbackUrlRaw = String(process.env.YANDEX_DELIVERY_CALLBACK_URL || '').trim();
const defaultTaxiClass = String(process.env.YANDEX_DELIVERY_TAXI_CLASS || '').trim().toLowerCase();
const defaultCargoType = String(process.env.YANDEX_DELIVERY_CARGO_TYPE || '').trim().toLowerCase();
const defaultCargoLoaders = toInteger(process.env.YANDEX_DELIVERY_CARGO_LOADERS);
const defaultCargoOptions = splitCsv(process.env.YANDEX_DELIVERY_CARGO_OPTIONS);
const skipDoorToDoor = toBoolean(process.env.YANDEX_DELIVERY_SKIP_DOOR_TO_DOOR, false);
const skipConfirmation = toBoolean(process.env.YANDEX_DELIVERY_SKIP_CONFIRMATION, true);
const skipClientNotify = toBoolean(process.env.YANDEX_DELIVERY_SKIP_CLIENT_NOTIFY, true);
const claimDueHours = toNumber(process.env.YANDEX_DELIVERY_DUE_HOURS);

const defaultLengthM = toMeters(process.env.YANDEX_DELIVERY_DEFAULT_LENGTH_CM, 30);
const defaultWidthM = toMeters(process.env.YANDEX_DELIVERY_DEFAULT_WIDTH_CM, 20);
const defaultHeightM = toMeters(process.env.YANDEX_DELIVERY_DEFAULT_HEIGHT_CM, 10);
const COURIER_MAX_KM = 5.5;
const EXPRESS_MAX_KM = 500;
const CARGO_INTERCITY_MAX_KM = 1500;

export class YandexDeliveryApiError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'YandexDeliveryApiError';
    this.status = options.status ?? null;
    this.code = options.code ?? null;
    this.detail = options.detail ?? null;
  }
}

export async function searchPvz({ query, city, lat, lon }) {
  if (isOtherDayMode()) {
    return searchPvzOtherDay({ query, city, lat, lon });
  }
  ensureCoreConfig();

  const normalizedCity = normalizeText(city);
  const normalizedQuery = normalizeText(query);

  let points = [];
  if (normalizedCity && normalizedQuery) {
    points = await geocodeMultipleQueries(
      [
        `${normalizedCity}, ${normalizedQuery}`,
        `${normalizedQuery}, ${normalizedCity}`,
      ],
      35,
      120,
    );
  } else if (normalizedCity) {
    points = await geocodeMultipleQueries(
      [
        `${normalizedCity}, пункт выдачи`,
        `${normalizedCity}, ПВЗ`,
        `${normalizedCity}, постамат`,
        normalizedCity,
      ],
      40,
      180,
    );
    if (!points.length) {
      points = await geocodeAddressCandidates(normalizedCity, 80);
    }
  } else if (normalizedQuery) {
    points = await geocodeAddressCandidates(normalizedQuery, 80);
  } else if (Number.isFinite(toNumber(lat)) && Number.isFinite(toNumber(lon))) {
    points = await reverseGeocodeCandidates(toNumber(lat), toNumber(lon), 20);
  } else {
    throw new Error('YANDEX: укажите город или строку поиска для ПВЗ.');
  }

  return points.map((point) => ({
    id: buildYandexPvzId(point.lon, point.lat),
    name: 'Яндекс Доставка — ПВЗ',
    address: point.fullname,
    lat: point.lat,
    lon: point.lon,
    provider: 'yandex',
  }));
}

export async function calculate(options) {
  if (isOtherDayMode()) {
    return calculateOtherDay(options);
  }
  ensureSupportedType(options?.type);
  ensureCoreConfig();

  const context = await buildDeliveryContext(options);
  const metadata = normalizeRecord(options?.provider_metadata);
  const distanceKm = estimateDistanceKm(pickupLat, pickupLon, context.dropoff.lat, context.dropoff.lon);
  const preferredTaxiClass = resolveTaxiClassByDistance(distanceKm);
  const attemptTaxiClasses = buildTaxiClassAttempts(distanceKm, metadata?.yandex_taxi_class);

  if (!attemptTaxiClasses.length) {
    throw new Error('YANDEX: Маршрут вне зоны текущих тарифов.');
  }

  const basePayload = {
    items: context.offerItems,
    route_points: context.offerRoutePoints,
    requirements: buildOfferRequirements(null),
  };

  const { data, payload: offerPayload } = await requestOffersWithFallback(basePayload, attemptTaxiClasses);

  const offers = normalizeOffers(data?.offers);
  if (!offers.length) {
    throw new Error('YANDEX: не удалось получить варианты доставки.');
  }

  const selectedOffer = selectOffer(offers, metadata);
  const price = extractOfferPrice(selectedOffer);
  if (!Number.isFinite(price) || price < 0) {
    throw new Error('YANDEX: API не вернул стоимость доставки.');
  }

  return {
    delivery_price: Number(price.toFixed(2)),
    delivery_currency: selectedOffer?.price?.currency ?? 'RUB',
    delivery_eta: formatDeliveryInterval(selectedOffer?.delivery_interval),
    tariff_code: selectedOffer?.taxi_class || defaultTaxiClass || 'courier',
    provider_metadata: {
      yandex_offer_payload: selectedOffer?.payload ?? null,
      yandex_offer_ttl: selectedOffer?.offer_ttl ?? null,
      yandex_taxi_class: selectedOffer?.taxi_class ?? null,
      yandex_distance_km: distanceKm,
      yandex_requested_taxi_class: preferredTaxiClass || null,
      yandex_pickup_interval: selectedOffer?.pickup_interval ?? null,
      yandex_delivery_interval: selectedOffer?.delivery_interval ?? null,
      yandex_dropoff_fullname: context.dropoff.fullname,
      yandex_dropoff_coordinates: [context.dropoff.lon, context.dropoff.lat],
      yandex_offer_request: offerPayload,
      yandex_offer_response: data ?? null,
    },
  };
}

export async function listTariffs(options) {
  if (isOtherDayMode()) {
    return listTariffsOtherDay(options);
  }
  const quote = await calculate(options);
  return [
    {
      tariff_code: quote.tariff_code ?? null,
      delivery_price: quote.delivery_price,
      delivery_currency: quote.delivery_currency ?? 'RUB',
      delivery_eta: quote.delivery_eta ?? null,
      provider_metadata: quote.provider_metadata ?? null,
    },
  ];
}

export async function createShipment(options) {
  if (isOtherDayMode()) {
    return createShipmentOtherDay(options);
  }
  ensureSupportedType(options?.type);
  ensureCoreConfig();

  const context = await buildDeliveryContext(options);
  const metadata = normalizeRecord(options?.provider_metadata);
  const due = buildClaimDue();
  const claimCreateBody = {
    items: context.claimItems,
    route_points: context.claimRoutePoints,
    comment: normalizeText(options?.comment),
    client_requirements: buildClientRequirements(metadata),
    skip_door_to_door: skipDoorToDoor,
    skip_client_notify: skipClientNotify,
    ...(metadata?.yandex_offer_payload ? { offer_payload: String(metadata.yandex_offer_payload) } : {}),
    ...(callbackUrlRaw ? { callback_properties: { callback_url: normalizeCallbackUrl(callbackUrlRaw) } } : {}),
    ...(due ? { due } : {}),
  };

  const requestId = randomUUID();
  const createResponse = await yandexRequest('/b2b/cargo/integration/v2/claims/create', {
    method: 'POST',
    query: { request_id: requestId },
    body: claimCreateBody,
  });

  const claimId = extractClaimId(createResponse);
  if (!claimId) {
    throw new Error('YANDEX: не удалось определить claim_id после создания заявки.');
  }

  const infoBeforeAccept = await fetchClaimInfo(claimId);
  const version = extractClaimVersion(infoBeforeAccept, createResponse);

  let acceptResponse = null;
  try {
    acceptResponse = await yandexRequest('/b2b/cargo/integration/v2/claims/accept', {
      method: 'POST',
      query: { claim_id: claimId },
      body: { version },
    });
  } catch (error) {
    const isInvalidTransition =
      error instanceof YandexDeliveryApiError &&
      error.status === 409 &&
      String(error.code || '').toLowerCase() === 'inappropriate_status';
    if (!isInvalidTransition) {
      throw error;
    }
  }

  const infoAfterAccept = await fetchClaimInfo(claimId);

  return {
    provider_order_id: claimId,
    track_number: null,
    payload: {
      request_id: requestId,
      create: claimCreateBody,
      accept: { claim_id: claimId, version },
    },
    response: {
      create: createResponse,
      info_before_accept: infoBeforeAccept,
      accept: acceptResponse,
      info_after_accept: infoAfterAccept,
    },
  };
}

async function fetchClaimInfo(claimId) {
  return yandexRequest('/b2b/cargo/integration/v2/claims/info', {
    method: 'POST',
    query: { claim_id: claimId },
  });
}

async function searchPvzOtherDay({ query, city, lat, lon }) {
  ensureOtherDayConfig();

  const normalizedQuery = normalizeText(query);
  const normalizedCity = normalizeText(city);
  const location = [normalizedCity, normalizedQuery].filter(Boolean).join(', ');
  let geoId = null;
  if (normalizedCity) {
    geoId = await detectGeoIdOtherDay(normalizedCity);
  }
  if (!geoId && location) {
    geoId = await detectGeoIdOtherDay(location);
  }
  const payload = await otherDayRequest('/api/b2b/platform/pickup-points/list', {
    method: 'POST',
    body: {
      ...(geoId ? { geo_id: geoId } : {}),
      type: 'pickup_point',
      payment_method: 'already_paid',
      available_for_dropoff: true,
    },
  });

  const list = Array.isArray(payload?.pickup_points)
    ? payload.pickup_points
    : Array.isArray(payload?.points)
      ? payload.points
      : Array.isArray(payload?.result?.pickup_points)
        ? payload.result.pickup_points
        : [];
  const queryNeedle = normalizeText(normalizedQuery).toLowerCase();
  const cityNeedle = normalizeText(normalizedCity).toLowerCase();

  let points = list
    .map((item) => {
      const id = normalizeText(item?.id) || normalizeText(item?.platform_station_id);
      if (!id) return null;
      const address = normalizePickupPointAddress(item);
      const name = normalizeText(item?.name) || 'Яндекс Доставка — ПВЗ';
      const coordinates = normalizeCoordinates(item?.position ?? item?.location ?? item?.coordinates);
      return {
        id,
        name,
        address,
        lat: coordinates?.lat,
        lon: coordinates?.lon,
        provider: 'yandex',
        provider_metadata: {
          yandex_platform_station_id: id,
          ...(address ? { yandex_dropoff_fullname: address } : {}),
          ...(coordinates ? { yandex_dropoff_coordinates: [coordinates.lon, coordinates.lat] } : {}),
        },
      };
    })
    .filter(Boolean);

  if (cityNeedle) {
    points = points.filter((point) => {
      const haystack = `${normalizeText(point?.name)} ${normalizeText(point?.address)}`.toLowerCase();
      return haystack.includes(cityNeedle);
    });
  }

  if (queryNeedle) {
    const ranked = rankPointsByQuery(points, queryNeedle);
    if (ranked.length) {
      points = ranked;
    }
  }

  const latNum = toNumber(lat);
  const lonNum = toNumber(lon);
  if (Number.isFinite(latNum) && Number.isFinite(lonNum)) {
    points.sort((a, b) => {
      const distanceA = estimateDistanceKm(latNum, lonNum, toNumber(a?.lat), toNumber(a?.lon));
      const distanceB = estimateDistanceKm(latNum, lonNum, toNumber(b?.lat), toNumber(b?.lon));
      return distanceA - distanceB;
    });
  }

  return points.slice(0, 100);
}

async function calculateOtherDay(options) {
  ensureSupportedType(options?.type);
  ensureOtherDayConfig();

  const type = normalizeType(options?.type);
  const metadata = normalizeRecord(options?.provider_metadata);
  const totalWeightKg = normalizeWeightKg(options?.total_weight);
  const sourceStationId = await resolveOtherDaySourceStationId();
  const destination = await buildOtherDayDestination({ type, options, metadata });
  const pricingBody = {
    source: { platform_station_id: sourceStationId },
    destination,
    tariff: resolveOtherDayTariff(type),
    total_weight: Math.max(1, Math.round(totalWeightKg * 1000)),
  };

  const pricing = await otherDayRequest('/api/b2b/platform/pricing-calculator', {
    method: 'POST',
    body: pricingBody,
  });

  const priceInfo = normalizeOtherDayPrice(pricing?.pricing_total);
  if (!priceInfo) {
    throw new Error('YANDEX: API Доставки по России не вернул стоимость маршрута.');
  }

  const eta = formatOtherDayEta(pricing?.delivery_days, pricing?.estimated_delivery_date);

  return {
    delivery_price: Number(priceInfo.amount.toFixed(2)),
    delivery_currency: priceInfo.currency || 'RUB',
    delivery_eta: eta,
    tariff_code: type === 'pvz' ? 'self_pickup' : 'time_interval',
    provider_metadata: {
      yandex_api_mode: 'other_day',
      yandex_source_station_id: sourceStationId,
      yandex_platform_station_id: destination?.platform_station_id ?? null,
      yandex_pricing_request: pricingBody,
      yandex_pricing_response: pricing ?? null,
      ...(destination?.address ? { yandex_dropoff_fullname: destination.address } : {}),
      ...(metadata?.yandex_dropoff_coordinates ? { yandex_dropoff_coordinates: metadata.yandex_dropoff_coordinates } : {}),
    },
  };
}

async function listTariffsOtherDay(options) {
  const quote = await calculateOtherDay(options);
  return [
    {
      tariff_code: quote.tariff_code ?? null,
      delivery_price: quote.delivery_price,
      delivery_currency: quote.delivery_currency ?? 'RUB',
      delivery_eta: quote.delivery_eta ?? null,
      provider_metadata: quote.provider_metadata ?? null,
    },
  ];
}

async function createShipmentOtherDay(options) {
  ensureSupportedType(options?.type);
  ensureOtherDayConfig();

  const type = normalizeType(options?.type);
  const metadata = normalizeRecord(options?.provider_metadata);
  const address = normalizeAddress(options?.address);
  const recipient = normalizeRecipient(options?.recipient);
  const totalWeightKg = normalizeWeightKg(options?.total_weight);
  const totalWeightG = Math.max(1, Math.round(totalWeightKg * 1000));
  const sourceStationId = await resolveOtherDaySourceStationId();
  const destination = await buildOtherDayDestination({ type, options, metadata });
  const destinationNode = buildOtherDayCreateDestination(type, destination, address, metadata);
  const recipientContact = buildOtherDayRecipientContact(recipient.name, recipient.phone, recipient.email);
  const itemSizeCm = {
    dx: metersToCentimeters(defaultLengthM, 30),
    dy: metersToCentimeters(defaultWidthM, 20),
    dz: metersToCentimeters(defaultHeightM, 10),
  };
  const placeBarcode = `AS-${randomUUID().replace(/-/g, '').slice(0, 16).toUpperCase()}`;
  const items = buildOtherDayCreateItems(options?.items, itemSizeCm, placeBarcode);
  const places = buildOtherDayCreatePlaces(totalWeightG, itemSizeCm, placeBarcode);
  const operatorRequestId =
    normalizeText(options?.order_number) ||
    normalizeText(options?.order_id) ||
    randomUUID();
  const requestComment = normalizeText(options?.comment) || null;

  const requestBody = {
    info: {
      operator_request_id: operatorRequestId,
      ...(otherDayMerchantId ? { merchant_id: otherDayMerchantId } : {}),
      ...(requestComment ? { comment: requestComment } : {}),
    },
    source: {
      platform_station: {
        platform_id: sourceStationId,
      },
    },
    destination: destinationNode,
    items,
    places,
    billing_info: {
      payment_method: 'already_paid',
      delivery_cost: 0,
    },
    recipient_info: recipientContact,
    last_mile_policy: resolveOtherDayTariff(type),
    particular_items_refuse: false,
    forbid_unboxing: false,
  };

  const response = await otherDayRequest('/api/b2b/platform/request/create', {
    method: 'POST',
    body: requestBody,
  });

  const requestId = normalizeText(response?.request_id);
  if (!requestId) {
    throw new Error('YANDEX: API Доставки по России не вернул request_id.');
  }

  return {
    provider_order_id: requestId,
    track_number: normalizeText(response?.track_code) || null,
    payload: {
      create: requestBody,
    },
    response: {
      create: response ?? null,
    },
  };
}

async function otherDayRequest(path, options = {}) {
  if (!apiToken) {
    throw new Error('YANDEX_DELIVERY_TOKEN (или YANDEX_DELIVERY_API_KEY) не задан.');
  }

  const url = new URL(path, OTHER_DAY_API_BASE);
  const response = await fetch(url, {
    method: options?.method || 'POST',
    headers: {
      Authorization: `Bearer ${apiToken}`,
      ...(apiClientId ? { 'X-Client-ID': apiClientId } : {}),
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Accept-Language': 'ru',
    },
    ...(options?.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });

  const rawText = await safeText(response);
  const payload = parseJson(rawText);

  if (!response.ok) {
    const code =
      normalizeText(payload?.code) ||
      normalizeText(payload?.error) ||
      normalizeText(payload?.status) ||
      null;
    const message =
      normalizeText(payload?.message) ||
      normalizeText(payload?.detail) ||
      normalizeText(rawText) ||
      `HTTP ${response.status}`;
    throw new YandexDeliveryApiError(`YANDEX: ${message}`, {
      status: response.status,
      code,
      detail: payload ?? rawText ?? null,
    });
  }

  return payload ?? {};
}

async function yandexRequest(path, options = {}) {
  if (!apiToken) {
    throw new Error('YANDEX_DELIVERY_TOKEN (или YANDEX_DELIVERY_API_KEY) не задан.');
  }

  const url = new URL(path, API_BASE);
  const query = options?.query && typeof options.query === 'object' ? options.query : {};
  for (const [key, value] of Object.entries(query)) {
    if (value == null) continue;
    const normalized = String(value).trim();
    if (!normalized) continue;
    url.searchParams.set(key, normalized);
  }

  const response = await fetch(url, {
    method: options?.method || 'POST',
    headers: {
      Authorization: `Bearer ${apiToken}`,
      ...(apiClientId ? { 'X-Client-ID': apiClientId } : {}),
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Accept-Language': 'ru',
    },
    ...(options?.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });

  const rawText = await safeText(response);
  const payload = parseJson(rawText);

  if (!response.ok) {
    const code =
      normalizeText(payload?.code) ||
      normalizeText(payload?.error) ||
      normalizeText(payload?.status) ||
      null;
    const message =
      normalizeText(payload?.message) ||
      normalizeText(payload?.detail) ||
      normalizeText(rawText) ||
      `HTTP ${response.status}`;
    throw new YandexDeliveryApiError(`YANDEX: ${message}`, {
      status: response.status,
      code,
      detail: payload ?? rawText ?? null,
    });
  }

  return payload ?? {};
}

async function buildDeliveryContext(options) {
  const normalizedType = normalizeType(options?.type);
  const address = normalizeAddress(options?.address);
  const recipient = normalizeRecipient(options?.recipient);
  const totalWeight = normalizeWeightKg(options?.total_weight);
  const metadata = normalizeRecord(options?.provider_metadata);

  let dropoffFullname = '';
  let dropoffCoordinates = null;

  if (normalizedType === 'pvz') {
    dropoffCoordinates =
      normalizeCoordinates(metadata?.yandex_dropoff_coordinates) ??
      parseCoordinatesFromPickupPointId(options?.pickup_point_id);
    dropoffFullname =
      normalizeText(metadata?.yandex_dropoff_fullname) ||
      normalizeText(options?.pickup_point_address) ||
      '';

    if (!dropoffCoordinates && dropoffFullname) {
      dropoffCoordinates = await geocodeAddress(dropoffFullname);
    }
    if (!dropoffCoordinates) {
      throw new Error('YANDEX: для ПВЗ не найдены координаты точки. Выберите ПВЗ заново.');
    }
    if (!dropoffFullname) {
      dropoffFullname = `ПВЗ ${String(options?.pickup_point_id ?? '').trim() || 'Яндекс'}`;
    }
  } else {
    const geocodeQueries = buildDoorGeocodeQueries(address);
    const dropoffAddressLine = geocodeQueries[0] || '';
    if (!dropoffAddressLine) {
      throw new Error('YANDEX: адрес получателя обязателен (город, улица, дом).');
    }
    dropoffCoordinates =
      normalizeCoordinates(metadata?.yandex_dropoff_coordinates) ??
      (await geocodeFirstSuccessful(geocodeQueries));
    dropoffFullname =
      normalizeText(metadata?.yandex_dropoff_fullname) ||
      dropoffAddressLine;
  }

  const dropoff = {
    fullname: dropoffFullname,
    lat: dropoffCoordinates?.lat ?? null,
    lon: dropoffCoordinates?.lon ?? null,
  };

  const offerRoutePoints = [
    {
      id: 1,
      coordinates: [pickupLon, pickupLat],
      fullname: pickupAddress,
    },
    buildOfferDropoffPoint(dropoff),
  ];

  const claimRoutePoints = [
    {
      point_id: 1,
      visit_order: 1,
      type: 'source',
      contact: {
        name: pickupContactName,
        phone: normalizePhone(pickupContactPhone),
        email: pickupContactEmail,
      },
      address: {
        fullname: pickupAddress,
        coordinates: [pickupLon, pickupLat],
      },
      skip_confirmation: skipConfirmation,
    },
    {
      point_id: 2,
      visit_order: 2,
      type: 'destination',
      contact: {
        name: recipient.name,
        phone: recipient.phone,
        ...(recipient.email ? { email: recipient.email } : {}),
      },
      address: {
        fullname: dropoff.fullname,
        ...(Number.isFinite(dropoff.lon) && Number.isFinite(dropoff.lat)
          ? { coordinates: [dropoff.lon, dropoff.lat] }
          : {}),
      },
      skip_confirmation: skipConfirmation,
    },
  ];

  return {
    type: normalizedType,
    dropoff,
    offerRoutePoints,
    claimRoutePoints,
    offerItems: buildOfferItems(totalWeight),
    claimItems: buildClaimItems(options?.items, totalWeight),
  };
}

function buildOfferItems(totalWeightKg) {
  return [
    {
      size: {
        length: defaultLengthM,
        width: defaultWidthM,
        height: defaultHeightM,
      },
      weight: roundNumber(totalWeightKg, 3),
      quantity: 1,
      pickup_point: 1,
      dropoff_point: 2,
    },
  ];
}

function buildClaimItems(rawItems, totalWeightKg) {
  const items = Array.isArray(rawItems) ? rawItems : [];
  if (!items.length) {
    return [
      {
        title: 'Заказ',
        quantity: 1,
        weight: roundNumber(totalWeightKg, 3),
        pickup_point: 1,
        dropoff_point: 2,
        cost_currency: 'RUB',
        cost_value: '0',
        size: {
          length: defaultLengthM,
          width: defaultWidthM,
          height: defaultHeightM,
        },
      },
    ];
  }

  const totalUnits = items.reduce((sum, item) => {
    const quantity = Math.max(1, toInteger(item?.quantity) ?? 1);
    return sum + quantity;
  }, 0);
  const weightPerUnit = roundNumber(Math.max(0.001, totalWeightKg / Math.max(1, totalUnits)), 3);

  const normalized = [];

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const quantity = Math.max(1, toInteger(item?.quantity) ?? 1);
    const title = normalizeText(item?.title) || normalizeText(item?.name) || `Товар ${index + 1}`;
    const cost = Number(item?.price);
    const unitCost = Number.isFinite(cost) && cost >= 0 ? cost : 0;

    normalized.push({
      extra_id: normalizeText(item?.productId) || normalizeText(item?.id) || `${index + 1}`,
      title,
      quantity,
      weight: weightPerUnit,
      pickup_point: 1,
      dropoff_point: 2,
      cost_currency: 'RUB',
      cost_value: String(roundNumber(unitCost, 2)),
      size: {
        length: defaultLengthM,
        width: defaultWidthM,
        height: defaultHeightM,
      },
    });
  }

  return normalized;
}

function buildOfferRequirements(taxiClass) {
  const normalizedTaxiClass = normalizeTaxiClass(taxiClass);
  const requirements = {
    ...(skipDoorToDoor ? { skip_door_to_door: true } : {}),
  };
  if (normalizedTaxiClass) {
    requirements.taxi_classes = [normalizedTaxiClass];
  }

  const due = buildClaimDue();
  if (due) requirements.due = due;

  return requirements;
}

function buildClientRequirements(rawMetadata) {
  const metadata = normalizeRecord(rawMetadata);
  const taxiClass = normalizeTaxiClass(metadata?.yandex_taxi_class) || defaultTaxiClass || 'courier';

  const clientRequirements = {
    taxi_class: taxiClass,
  };

  if (taxiClass === 'cargo' || taxiClass === 'cargo_intercity') {
    if (defaultCargoType) clientRequirements.cargo_type = defaultCargoType;
    if (Number.isFinite(defaultCargoLoaders) && defaultCargoLoaders >= 0) {
      clientRequirements.cargo_loaders = defaultCargoLoaders;
    }
    if (defaultCargoOptions.length) {
      clientRequirements.cargo_options = defaultCargoOptions;
    }
  }

  return clientRequirements;
}

async function requestOffersWithFallback(basePayload, taxiClassAttempts) {
  const attempts = Array.isArray(taxiClassAttempts) && taxiClassAttempts.length ? taxiClassAttempts : [null];
  let lastError = null;

  for (const taxiClass of attempts) {
    const payload = {
      ...basePayload,
      requirements: buildOfferRequirements(taxiClass),
    };
    try {
      const data = await yandexRequest('/b2b/cargo/integration/v2/offers/calculate', {
        method: 'POST',
        body: payload,
      });
      const offers = normalizeOffers(data?.offers);
      if (offers.length) {
        return { data, payload };
      }
      lastError = new Error('YANDEX: не удалось получить варианты доставки.');
    } catch (error) {
      lastError = error;
      if (!isTariffStrategyError(error)) {
        throw error;
      }
    }
  }

  const requestedTaxiClass = attempts.find((item) => normalizeTaxiClass(item)) || null;
  if (lastError && isTariffStrategyError(lastError)) {
    throw new Error(buildTariffUnavailableMessage(requestedTaxiClass));
  }
  throw lastError || new Error(buildTariffUnavailableMessage(requestedTaxiClass));
}

function buildClaimDue() {
  if (!Number.isFinite(claimDueHours) || claimDueHours <= 0) return null;
  return new Date(Date.now() + claimDueHours * 60 * 60 * 1000).toISOString();
}

function normalizeOffers(rawOffers) {
  const list = Array.isArray(rawOffers) ? rawOffers : [];
  return list
    .map((offer) => ({
      ...offer,
      price: {
        total_price: toNumber(offer?.price?.total_price),
        total_price_with_vat: toNumber(offer?.price?.total_price_with_vat),
        base_price: toNumber(offer?.price?.base_price),
        currency: normalizeText(offer?.price?.currency) || 'RUB',
      },
    }))
    .filter((offer) => Number.isFinite(extractOfferPrice(offer)));
}

function selectOffer(offers, metadata) {
  const requestedPayload = normalizeText(metadata?.yandex_offer_payload);
  if (requestedPayload) {
    const exact = offers.find((offer) => normalizeText(offer?.payload) === requestedPayload);
    if (exact) return exact;
  }

  return offers.reduce((best, current) => {
    if (!best) return current;
    return extractOfferPrice(current) < extractOfferPrice(best) ? current : best;
  }, null);
}

function extractOfferPrice(offer) {
  if (!offer || typeof offer !== 'object') return NaN;
  const withVat = toNumber(offer?.price?.total_price_with_vat);
  if (Number.isFinite(withVat)) return withVat;
  const total = toNumber(offer?.price?.total_price);
  if (Number.isFinite(total)) return total;
  return NaN;
}

function extractClaimId(payload) {
  const value = normalizeText(payload?.id);
  return value || null;
}

function resolveTaxiClassByDistance(distanceKm) {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) return '';
  if (distanceKm <= COURIER_MAX_KM) return 'courier';
  if (distanceKm <= EXPRESS_MAX_KM) return 'express';
  if (distanceKm <= CARGO_INTERCITY_MAX_KM) return 'cargo_intercity';
  return '';
}

function buildTaxiClassAttempts(distanceKm, metadataTaxiClass) {
  const forced = normalizeTaxiClass(metadataTaxiClass);
  if (forced) {
    return [forced, null];
  }

  if (!Number.isFinite(distanceKm) || distanceKm < 0) {
    return [null];
  }

  if (distanceKm <= COURIER_MAX_KM) {
    return ['courier', 'express', null];
  }
  if (distanceKm <= EXPRESS_MAX_KM) {
    return ['express', 'courier', null];
  }
  if (distanceKm <= CARGO_INTERCITY_MAX_KM) {
    return ['cargo_intercity', 'express', 'courier', null];
  }

  return [];
}

function buildTariffUnavailableMessage(taxiClass) {
  if (taxiClass === 'cargo_intercity') {
    return 'YANDEX: Для выбранного маршрута сейчас нет доступного тарифа cargo_intercity.';
  }
  return 'YANDEX: Для выбранного маршрута сейчас нет доступного тарифа в текущей тарифной линейке.';
}

function estimateDistanceKm(lat1, lon1, lat2, lon2) {
  if (![lat1, lon1, lat2, lon2].every((value) => Number.isFinite(value))) return NaN;
  const toRadians = (value) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return roundNumber(earthRadiusKm * c, 3);
}

function isTariffStrategyError(error) {
  if (!(error instanceof YandexDeliveryApiError)) return false;
  const source = `${normalizeText(error.message)} ${normalizeText(error.code)} ${normalizeText(error.detail?.message)}`.toLowerCase();
  return source.includes('not_present_in_tariff_line_strategy') || /тариф|tariff|стратег|strateg/.test(source);
}

function isOtherDayMode() {
  if (['other_day', 'other-day', 'russia', 'platform'].includes(apiModeRaw)) return true;
  if (['express', 'cargo', 'integration_v2'].includes(apiModeRaw)) return false;
  return Boolean(otherDaySourceStationId);
}

function ensureOtherDayConfig() {
  if (!apiToken) {
    throw new Error('YANDEX_DELIVERY_TOKEN (или YANDEX_DELIVERY_API_KEY) не задан.');
  }
}

async function resolveOtherDaySourceStationId() {
  if (otherDaySourceStationId) return otherDaySourceStationId;
  if (cachedResolvedSourceStationId) return cachedResolvedSourceStationId;

  const range = 0.2;
  const byCoordinates = await otherDayRequest('/api/b2b/platform/pickup-points/list', {
    method: 'POST',
    body: {
      type: 'pickup_point',
      available_for_dropoff: true,
      latitude: { from: pickupLat - range, to: pickupLat + range },
      longitude: { from: pickupLon - range, to: pickupLon + range },
    },
  });
  let points = Array.isArray(byCoordinates?.points) ? byCoordinates.points : [];

  if (!points.length && pickupAddress) {
    const pickupGeoId = await detectGeoIdOtherDay(pickupAddress);
    if (pickupGeoId) {
      const byGeoId = await otherDayRequest('/api/b2b/platform/pickup-points/list', {
        method: 'POST',
        body: {
          type: 'pickup_point',
          available_for_dropoff: true,
          geo_id: pickupGeoId,
        },
      });
      points = Array.isArray(byGeoId?.points) ? byGeoId.points : [];
    }
  }

  const sourcePoint = points
    .map((point) => {
      const stationId = normalizeText(point?.id);
      const coordinates = normalizeCoordinates(point?.position);
      if (!stationId || !coordinates) return null;
      const distanceKm = estimateDistanceKm(pickupLat, pickupLon, coordinates.lat, coordinates.lon);
      return { stationId, distanceKm };
    })
    .filter(Boolean)
    .sort((a, b) => a.distanceKm - b.distanceKm)[0];

  if (!sourcePoint?.stationId) {
    throw new Error('YANDEX: не удалось автоматически определить source platform_station_id для API Доставки по России.');
  }

  cachedResolvedSourceStationId = sourcePoint.stationId;
  return cachedResolvedSourceStationId;
}

async function detectGeoIdOtherDay(location) {
  const text = normalizeText(location);
  if (!text) return null;

  try {
    const payload = await otherDayRequest('/api/b2b/platform/location/detect', {
      method: 'POST',
      body: { location: text },
    });
    const geoId =
      payload?.geo_id ??
      payload?.id ??
      (Array.isArray(payload?.variants) ? payload.variants[0]?.geo_id ?? null : null);
    const numeric = Number(geoId);
    return Number.isFinite(numeric) ? numeric : null;
  } catch {
    return null;
  }
}

function normalizePickupPointAddress(point) {
  const direct =
    normalizeText(point?.full_address) ||
    normalizeText(point?.address?.full_address) ||
    normalizeText(point?.address?.formatted_address) ||
    normalizeText(point?.address) ||
    normalizeText(point?.location_name);
  if (direct) return direct;

  const address = point?.address_data && typeof point.address_data === 'object' ? point.address_data : {};
  const parts = [
    normalizeText(address?.region),
    normalizeText(address?.city),
    normalizeText(address?.street),
    normalizeText(address?.house),
  ].filter(Boolean);
  return parts.join(', ');
}

async function buildOtherDayDestination({ type, options, metadata }) {
  if (type === 'pvz') {
    const platformStationId = await resolveOtherDayDestinationStationId({
      metadata,
      pickupPointId: options?.pickup_point_id,
      pickupPointAddress: options?.pickup_point_address,
    });
    if (!platformStationId) {
      throw new Error('YANDEX: для ПВЗ не найден platform_station_id. Выберите ПВЗ заново.');
    }
    return { platform_station_id: platformStationId };
  }

  const address = normalizeAddress(options?.address);
  const addressLine = composeAddressLine(address);
  if (!addressLine) {
    throw new Error('YANDEX: адрес получателя обязателен (город, улица, дом).');
  }
  return { address: addressLine };
}

async function resolveOtherDayDestinationStationId({ metadata, pickupPointId, pickupPointAddress }) {
  const metadataStationId = normalizeText(metadata?.yandex_platform_station_id);
  if (isLikelyPlatformStationId(metadataStationId)) return metadataStationId;

  const rawPickupPointId = normalizeText(pickupPointId);
  if (isLikelyPlatformStationId(rawPickupPointId)) return rawPickupPointId;

  const dropoffCoordinates =
    normalizeCoordinates(metadata?.yandex_dropoff_coordinates) ??
    parseCoordinatesFromPickupPointId(rawPickupPointId);
  const dropoffAddress =
    normalizeText(metadata?.yandex_dropoff_fullname) ||
    normalizeText(pickupPointAddress) ||
    '';

  if (dropoffCoordinates) {
    for (const radius of [0.01, 0.03, 0.08]) {
      const nearbyPayload = await otherDayRequest('/api/b2b/platform/pickup-points/list', {
        method: 'POST',
        body: {
          type: 'pickup_point',
          latitude: { from: dropoffCoordinates.lat - radius, to: dropoffCoordinates.lat + radius },
          longitude: { from: dropoffCoordinates.lon - radius, to: dropoffCoordinates.lon + radius },
        },
      });
      const nearbyPoints = Array.isArray(nearbyPayload?.points) ? nearbyPayload.points : [];
      const matchedNearby = pickBestOtherDayPoint(nearbyPoints, dropoffCoordinates, dropoffAddress);
      if (matchedNearby) return matchedNearby;
    }
  }

  if (dropoffAddress) {
    const geoId = await detectGeoIdOtherDay(dropoffAddress);
    if (geoId) {
      const byGeoPayload = await otherDayRequest('/api/b2b/platform/pickup-points/list', {
        method: 'POST',
        body: {
          type: 'pickup_point',
          geo_id: geoId,
        },
      });
      const byGeoPoints = Array.isArray(byGeoPayload?.points) ? byGeoPayload.points : [];
      const matchedByGeo = pickBestOtherDayPoint(byGeoPoints, dropoffCoordinates, dropoffAddress);
      if (matchedByGeo) return matchedByGeo;
    }
  }

  return '';
}

function pickBestOtherDayPoint(points, coordinates, address) {
  const list = Array.isArray(points) ? points : [];
  if (!list.length) return '';

  const normalizedAddress = normalizeText(address).toLowerCase();
  if (normalizedAddress) {
    const exact = list.find((point) => {
      const fullAddress = normalizePickupPointAddress(point).toLowerCase();
      return fullAddress && (fullAddress.includes(normalizedAddress) || normalizedAddress.includes(fullAddress));
    });
    if (exact?.id) return normalizeText(exact.id);
  }

  const withCoords = list
    .map((point) => {
      const stationId = normalizeText(point?.id);
      const pointCoordinates = normalizeCoordinates(point?.position ?? point?.location ?? point?.coordinates);
      if (!stationId || !pointCoordinates) return null;
      const distanceKm = estimateDistanceKm(
        coordinates?.lat,
        coordinates?.lon,
        pointCoordinates.lat,
        pointCoordinates.lon,
      );
      return { stationId, distanceKm };
    })
    .filter(Boolean)
    .sort((a, b) => a.distanceKm - b.distanceKm);

  return withCoords[0]?.stationId || '';
}

function resolveOtherDayTariff(type) {
  return type === 'pvz' ? 'self_pickup' : 'time_interval';
}

function buildOtherDayCreateDestination(type, destination, address, metadata) {
  if (type === 'pvz') {
    const platformStationId = normalizeText(destination?.platform_station_id);
    if (!platformStationId) {
      throw new Error('YANDEX: для ПВЗ не найден platform_station_id. Выберите ПВЗ заново.');
    }
    return {
      type: 'platform_station',
      platform_station: { platform_id: platformStationId },
      custom_location: null,
      interval_utc: null,
    };
  }

  const fullAddress = normalizeText(destination?.address) || composeAddressLine(address);
  if (!fullAddress) {
    throw new Error('YANDEX: адрес получателя обязателен (город, улица, дом).');
  }
  const coords = normalizeCoordinates(metadata?.yandex_dropoff_coordinates);

  const details = {
    country: 'Россия',
    ...(address?.region ? { region: address.region } : {}),
    ...(address?.city ? { locality: address.city } : {}),
    ...(address?.street ? { street: address.street } : {}),
    ...(address?.house ? { house: address.house } : {}),
    ...(address?.flat ? { room: address.flat } : {}),
    ...(address?.postal_code ? { postal_code: address.postal_code } : {}),
    full_address: fullAddress,
  };

  return {
    type: 'custom_location',
    platform_station: null,
    custom_location: {
      ...(coords ? { latitude: coords.lat, longitude: coords.lon } : {}),
      details,
    },
    interval_utc: null,
  };
}

function buildOtherDayRecipientContact(fullName, phone, email) {
  const parts = normalizeText(fullName)
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const firstName = parts[0] || 'Получатель';
  const lastName = parts[1] || firstName;
  const patronymic = parts.length > 2 ? parts.slice(2).join(' ') : '';

  return {
    first_name: firstName,
    last_name: lastName,
    ...(patronymic ? { patronymic: patronymic } : {}),
    phone,
    ...(email ? { email } : {}),
  };
}

function metersToCentimeters(value, fallbackCm) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return Math.max(1, Math.round(fallbackCm));
  }
  return Math.max(1, Math.round(numeric * 100));
}

function buildOtherDayCreateItems(rawItems, sizeCm, placeBarcode) {
  const items = Array.isArray(rawItems) ? rawItems : [];
  if (!items.length) {
    return [
      {
        count: 1,
        name: 'Заказ',
        article: 'AS-ITEM-1',
        place_barcode: placeBarcode,
        physical_dims: {
          dx: sizeCm.dx,
          dy: sizeCm.dy,
          dz: sizeCm.dz,
        },
        billing_details: {
          unit_price: 0,
          assessed_unit_price: 0,
        },
      },
    ];
  }

  return items.map((item, index) => {
    const count = Math.max(1, toInteger(item?.quantity) ?? 1);
    const unitPriceRub = Number(item?.price);
    const safeUnitPriceKopecks =
      Number.isFinite(unitPriceRub) && unitPriceRub >= 0
        ? Math.round(unitPriceRub * 100)
        : 0;
    return {
      count,
      name: normalizeText(item?.title) || normalizeText(item?.name) || `Товар ${index + 1}`,
      article:
        normalizeText(item?.article) ||
        normalizeText(item?.sku) ||
        normalizeText(item?.productId) ||
        normalizeText(item?.id) ||
        `AS-ITEM-${index + 1}`,
      place_barcode: placeBarcode,
      physical_dims: {
        dx: sizeCm.dx,
        dy: sizeCm.dy,
        dz: sizeCm.dz,
      },
      billing_details: {
        unit_price: safeUnitPriceKopecks,
        assessed_unit_price: safeUnitPriceKopecks,
      },
    };
  });
}

function buildOtherDayCreatePlaces(totalWeightG, sizeCm, placeBarcode) {
  return [
    {
      physical_dims: {
        weight_gross: Math.max(1, Math.round(totalWeightG)),
        dx: sizeCm.dx,
        dy: sizeCm.dy,
        dz: sizeCm.dz,
      },
      barcode: placeBarcode,
    },
  ];
}

function normalizeOtherDayPrice(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return { amount: value, currency: 'RUB' };
  }
  const raw = normalizeText(value);
  if (!raw) return null;
  const match = raw.match(/([0-9]+(?:[.,][0-9]+)?)\s*([A-Za-zА-Яа-я]{3})?/);
  if (!match) return null;
  const amount = Number(match[1].replace(',', '.'));
  if (!Number.isFinite(amount)) return null;
  return {
    amount,
    currency: normalizeText(match[2]).toUpperCase() || 'RUB',
  };
}

function formatOtherDayEta(deliveryDays, estimatedDate) {
  const numericDays = Number(deliveryDays);
  if (Number.isFinite(numericDays) && numericDays > 0) {
    return `до ${Math.trunc(numericDays)} дн.`;
  }

  const dateText = normalizeText(estimatedDate);
  if (dateText) {
    const parsed = new Date(dateText);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
      });
    }
  }
  return null;
}

function buildOtherDayItems(rawItems, totalWeightKg) {
  const items = Array.isArray(rawItems) ? rawItems : [];
  if (!items.length) {
    return [
      {
        name: 'Заказ',
        quantity: 1,
        weight: Math.max(1, Math.round(totalWeightKg * 1000)),
      },
    ];
  }

  const totalUnits = items.reduce((sum, item) => sum + Math.max(1, toInteger(item?.quantity) ?? 1), 0);
  const unitWeightG = Math.max(1, Math.round((totalWeightKg * 1000) / Math.max(1, totalUnits)));
  return items.map((item, index) => ({
    name: normalizeText(item?.title) || normalizeText(item?.name) || `Товар ${index + 1}`,
    quantity: Math.max(1, toInteger(item?.quantity) ?? 1),
    weight: unitWeightG,
    ...(Number.isFinite(Number(item?.price)) ? { declared_cost: roundNumber(Number(item.price), 2) } : {}),
  }));
}

function rankPointsByQuery(points, queryNeedle) {
  const list = Array.isArray(points) ? points : [];
  const rawQuery = normalizeText(queryNeedle).toLowerCase();
  if (!rawQuery) return list;

  const tokens = rawQuery
    .split(/[\s,.;:()\-_/]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);

  const scored = list
    .map((point) => {
      const haystack = `${normalizeText(point?.name)} ${normalizeText(point?.address)}`.toLowerCase();
      let score = 0;
      if (haystack.includes(rawQuery)) {
        score += 100;
      }
      for (const token of tokens) {
        if (haystack.includes(token)) score += 10;
      }
      return { point, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.point);

  return scored;
}

function extractClaimVersion(...payloads) {
  for (const payload of payloads) {
    const numeric = toInteger(payload?.version);
    if (Number.isFinite(numeric) && numeric >= 0) {
      return numeric;
    }
  }
  return 1;
}

function formatDeliveryInterval(interval) {
  const fromRaw = normalizeText(interval?.from);
  const toRaw = normalizeText(interval?.to);
  if (!fromRaw && !toRaw) return null;

  const from = formatDateTime(fromRaw);
  const to = formatDateTime(toRaw);
  if (from && to) return `${from} - ${to}`;
  return from || to || null;
}

function formatDateTime(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function ensureSupportedType(type) {
  const normalized = normalizeType(type);
  if (!normalized) {
    throw new Error('YANDEX: поддерживается только доставка до двери или в ПВЗ.');
  }
}

function normalizeType(type) {
  const normalized = normalizeText(type).toLowerCase();
  if (normalized === 'door' || normalized === 'pvz') return normalized;
  return '';
}

function ensureCoreConfig() {
  if (!apiToken) {
    throw new Error('YANDEX_DELIVERY_TOKEN (или YANDEX_DELIVERY_API_KEY) не задан.');
  }
  if (!apiClientId) {
    throw new Error('YANDEX_DELIVERY_CLIENT_ID не задан.');
  }
  if (!pickupAddress) {
    throw new Error('YANDEX_DELIVERY_PICKUP_ADDRESS не задан.');
  }
  if (!Number.isFinite(pickupLat) || !Number.isFinite(pickupLon)) {
    throw new Error('YANDEX_DELIVERY_PICKUP_LAT и YANDEX_DELIVERY_PICKUP_LON должны быть заданы.');
  }
  if (!pickupContactEmail) {
    throw new Error('YANDEX_DELIVERY_PICKUP_CONTACT_EMAIL обязателен для точки отправителя.');
  }
}

function normalizeAddress(raw) {
  const safe = raw && typeof raw === 'object' ? raw : {};
  return {
    region: normalizeText(safe.region),
    city: normalizeText(safe.city),
    postal_code: normalizeText(safe.postal_code),
    street: normalizeText(safe.street),
    house: normalizeText(safe.house),
    flat: normalizeText(safe.flat),
  };
}

function composeAddressLine(address) {
  const parts = [
    address?.region,
    address?.city,
    address?.street,
    address?.house,
    address?.flat ? `кв. ${address.flat}` : '',
  ]
    .map((value) => normalizeText(value))
    .filter(Boolean);
  return parts.join(', ');
}

function buildDoorGeocodeQueries(address) {
  const region = normalizeText(address?.region);
  const city = normalizeText(address?.city);
  const postalCode = normalizeText(address?.postal_code);
  const street = normalizeText(address?.street);
  const house = normalizeText(address?.house);
  const flat = normalizeText(address?.flat);

  const flatVariants = flat ? ['', `кв. ${flat}`] : [''];
  const variants = [];
  for (const flatSuffix of flatVariants) {
    variants.push(
      [postalCode, region, city, street, house, flatSuffix],
      [region, city, street, house, flatSuffix],
      [postalCode, city, street, house, flatSuffix],
      [city, street, house, flatSuffix],
      [street, house, city, region, flatSuffix],
      [street, house, city, flatSuffix],
      [city, street, `дом ${house}`, flatSuffix],
      [street, `дом ${house}`, city, flatSuffix],
    );
  }

  const lines = variants
    .map((parts) =>
      parts
        .map((value) => normalizeText(value))
        .filter(Boolean)
        .join(', '),
    )
    .filter(Boolean);

  const unique = [...new Set(lines)];
  const withCountry = unique.map((line) => `${line}, Россия`);
  return [...new Set([...unique, ...withCountry])];
}

function buildOfferDropoffPoint(dropoff) {
  if (Number.isFinite(dropoff.lon) && Number.isFinite(dropoff.lat)) {
    return {
      id: 2,
      coordinates: [dropoff.lon, dropoff.lat],
      fullname: dropoff.fullname,
    };
  }
  return {
    id: 2,
    fullname: dropoff.fullname,
  };
}

function normalizeRecipient(raw) {
  const safe = raw && typeof raw === 'object' ? raw : {};
  const name = normalizeText(safe.full_name) || normalizeText(safe.name) || 'Получатель';
  const phone = normalizePhone(safe.phone);
  const email = normalizeText(safe.email);
  return { name, phone, email };
}

function normalizePhone(value) {
  const raw = normalizeText(value);
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '+79000000000';
  if (digits.length === 10) return `+7${digits}`;
  if (digits.length === 11 && digits.startsWith('8')) return `+7${digits.slice(1)}`;
  if (digits.length === 11 && digits.startsWith('7')) return `+${digits}`;
  return `+${digits}`;
}

function normalizeCoordinates(value) {
  if (Array.isArray(value) && value.length >= 2) {
    const lon = toNumber(value[0]);
    const lat = toNumber(value[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { lat, lon };
  }

  if (!value || typeof value !== 'object') return null;
  const lon = toNumber(value?.lon ?? value?.lng ?? value?.longitude);
  const lat = toNumber(value?.lat ?? value?.latitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon };
}

function buildYandexPvzId(lon, lat) {
  return `yandex:${Number(lon).toFixed(6)}:${Number(lat).toFixed(6)}`;
}

function parseCoordinatesFromPickupPointId(value) {
  const raw = normalizeText(value);
  if (!raw) return null;

  const fromPrefixed = raw.match(/^yandex:([+-]?\d+(?:\.\d+)?):([+-]?\d+(?:\.\d+)?)$/i);
  if (fromPrefixed) {
    return normalizeCoordinates([Number(fromPrefixed[1]), Number(fromPrefixed[2])]);
  }

  const parts = raw.split(',');
  if (parts.length === 2) {
    const maybeLat = toNumber(parts[0]);
    const maybeLon = toNumber(parts[1]);
    if (Number.isFinite(maybeLat) && Number.isFinite(maybeLon)) {
      return { lat: maybeLat, lon: maybeLon };
    }
  }

  return null;
}

async function geocodeAddress(query) {
  const text = normalizeText(query);
  if (!text) return null;

  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');
  url.searchParams.set('countrycodes', 'ru');
  url.searchParams.set('q', text);

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'auto-silicone.ru (yandex delivery geocoder)',
    },
  });
  if (!response.ok) return null;

  const payload = await response.json();
  const first = Array.isArray(payload) ? payload[0] : null;
  if (!first) return null;
  const lat = toNumber(first?.lat);
  const lon = toNumber(first?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon };
}

async function geocodeFirstSuccessful(queries) {
  const list = Array.isArray(queries) ? queries : [];
  for (const query of list) {
    const coordinates = await geocodeAddress(query);
    if (coordinates) return coordinates;
  }
  return null;
}

async function geocodeAddressCandidates(query, limit = 20) {
  const text = normalizeText(query);
  if (!text) return [];

  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', String(Math.max(1, Math.min(limit, 50))));
  url.searchParams.set('countrycodes', 'ru');
  url.searchParams.set('q', text);

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'auto-silicone.ru (yandex delivery pvz search)',
    },
  });
  if (!response.ok) return [];

  const payload = await response.json();
  const list = Array.isArray(payload) ? payload : [];

  return list
    .map((item) => {
      const lat = toNumber(item?.lat);
      const lon = toNumber(item?.lon);
      const fullname = normalizeText(item?.display_name);
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || !fullname) return null;
      return { lat, lon, fullname };
    })
    .filter(Boolean);
}

async function geocodeMultipleQueries(queries, perQueryLimit = 30, totalLimit = 120) {
  const list = Array.isArray(queries) ? queries : [];
  const uniqueQueries = [...new Set(list.map((value) => normalizeText(value)).filter(Boolean))];
  if (!uniqueQueries.length) return [];

  const merged = [];
  const seen = new Set();

  for (const query of uniqueQueries) {
    const candidates = await geocodeAddressCandidates(query, perQueryLimit);
    for (const candidate of candidates) {
      const key = `${roundNumber(candidate.lon, 6)}:${roundNumber(candidate.lat, 6)}:${candidate.fullname.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(candidate);
      if (merged.length >= totalLimit) return merged;
    }
  }

  return merged;
}

async function reverseGeocodeCandidates(lat, lon, limit = 20) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return [];

  const url = new URL('https://nominatim.openstreetmap.org/reverse');
  url.searchParams.set('format', 'json');
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lon));
  url.searchParams.set('zoom', '18');
  url.searchParams.set('addressdetails', '1');

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'auto-silicone.ru (yandex delivery pvz reverse)',
    },
  });
  if (!response.ok) return [];

  const payload = await response.json();
  const displayName = normalizeText(payload?.display_name);
  if (!displayName) return [];
  return geocodeAddressCandidates(displayName, limit);
}

function normalizeWeightKg(value) {
  const weight = toNumber(value);
  if (!Number.isFinite(weight) || weight <= 0) {
    throw new Error('YANDEX: вес отправления обязателен и должен быть больше нуля.');
  }
  return weight;
}

function normalizeTaxiClass(value) {
  const normalized = normalizeText(value).toLowerCase();
  if (['courier', 'express', 'cargo', 'cargo_intercity'].includes(normalized)) {
    return normalized;
  }
  return '';
}

function isLikelyPlatformStationId(value) {
  const normalized = normalizeText(value);
  if (!normalized) return false;
  if (/^[0-9a-f]{32}$/i.test(normalized)) return true;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(normalized)) return true;
  return false;
}

function normalizeCallbackUrl(value) {
  const normalized = normalizeText(value);
  if (!normalized) return '';
  if (normalized.endsWith('?') || normalized.endsWith('&')) {
    return normalized;
  }
  return normalized.includes('?') ? `${normalized}&` : `${normalized}?`;
}

function normalizeRecord(value) {
  return value && typeof value === 'object' ? value : {};
}

function normalizeText(value) {
  if (typeof value === 'string') return value.trim();
  if (value == null) return '';
  return String(value).trim();
}

function splitCsv(value) {
  const raw = typeof value === 'string' ? value : '';
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function toBoolean(value, fallback = false) {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return false;
  return fallback;
}

function toInteger(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.trunc(numeric);
}

function toNumber(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return NaN;
  return numeric;
}

function roundNumber(value, digits = 3) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  const factor = 10 ** digits;
  return Math.round(numeric * factor) / factor;
}

function toMeters(value, fallbackCm) {
  const numeric = toNumber(value);
  if (Number.isFinite(numeric) && numeric > 0) {
    return roundNumber(numeric / 100, 3);
  }
  return roundNumber(fallbackCm / 100, 3);
}

async function safeText(response) {
  try {
    return await response.text();
  } catch (error) {
    return '';
  }
}

function parseJson(value) {
  const text = normalizeText(value);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
}
