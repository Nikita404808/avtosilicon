import crypto from 'node:crypto';

const DEFAULT_SIGNATURE_HEADER = 'x-signature';
const DEFAULT_PAYMENT_URL_FIELD = 'payment_url';
const DEFAULT_WEBHOOK_ORDER_FIELD = 'order.id';
const DEFAULT_WEBHOOK_STATUS_FIELD = 'status';

export function normalizeOzonBankConfig(source = process.env) {
  const env = source ?? {};
  const pick = (key, fallback = '') =>
    typeof env[key] === 'string' ? env[key].trim() : fallback;

  const timeoutMs = Number(env.OZON_BANK_TIMEOUT_MS ?? 15000);

  return {
    apiBase: trimTrailingSlash(
      pick('OZON_BANK_API_BASE') || pick('OZON_BANK_BASE_URL'),
    ),
    merchantId: pick('OZON_BANK_MERCHANT_ID') || pick('OZON_BANK_MERCHANT'),
    apiSecret: pick('OZON_BANK_API_SECRET') || pick('OZON_BANK_SECRET'),
    webhookSecret: pick('OZON_BANK_WEBHOOK_SECRET') || pick('WEBHOOK_SECRET'),
    createPaymentPath:
      normalizePath(pick('OZON_BANK_CREATE_PAYMENT_PATH')) || '/payments',
    paymentUrlField:
      pick('OZON_BANK_PAYMENT_URL_FIELD') || DEFAULT_PAYMENT_URL_FIELD,
    webhookOrderField:
      pick('OZON_BANK_WEBHOOK_ORDER_FIELD') || DEFAULT_WEBHOOK_ORDER_FIELD,
    webhookStatusField:
      pick('OZON_BANK_WEBHOOK_STATUS_FIELD') || DEFAULT_WEBHOOK_STATUS_FIELD,
    successUrl: pick('PAYMENT_SUCCESS_URL'),
    failUrl: pick('PAYMENT_FAIL_URL'),
    signatureHeader:
      pick('OZON_BANK_SIGNATURE_HEADER') || DEFAULT_SIGNATURE_HEADER,
    webhookSignatureHeader:
      pick('OZON_BANK_WEBHOOK_SIGNATURE_HEADER') || DEFAULT_SIGNATURE_HEADER,
    timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : 15000,
  };
}

export function createOzonBankAdapter(userConfig = {}) {
  const config = {
    ...normalizeOzonBankConfig(),
    ...(userConfig || {}),
  };
  config.staticHeaders = config.staticHeaders ?? {};

  function buildPaymentEnvelope(context = {}) {
    const normalizedAmount = Number(context.amount);
    const amount =
      Number.isFinite(normalizedAmount) && normalizedAmount >= 0
        ? normalizedAmount
        : 0;
    const orderId = String(context.orderId ?? context.id ?? '').trim();
    const currency =
      typeof context.currency === 'string' && context.currency.trim()
        ? context.currency.trim()
        : 'RUB';

    const basePayload = {
      merchant: config.merchantId || null,
      order: {
        id: orderId,
        amount: amount,
        currency,
      },
      return_urls: {
        success: config.successUrl || null,
        fail: config.failUrl || null,
      },
      metadata: {
        description:
          typeof context.description === 'string' ? context.description : null,
        user_id:
          context.userId != null
            ? String(context.userId)
            : context?.order?.user_id ?? null,
        reference: context.reference ?? null,
      },
    };

    if (context.items) {
      basePayload.metadata.items = context.items;
    }
    if (context.extra) {
      basePayload.metadata.extra = context.extra;
    }

    if (typeof config.payloadBuilder === 'function') {
      return config.payloadBuilder(basePayload, context);
    }

    return basePayload;
  }

  function signPayload(payload) {
    const serialized = canonicalStringify(payload);
    if (typeof config.signer === 'function') {
      const custom = config.signer({
        payload,
        serialized,
        secret: config.apiSecret || '',
      });
      if (custom && typeof custom.signature === 'string') {
        return {
          serialized: custom.serialized ?? serialized,
          signature: custom.signature,
        };
      }
    }
    const signature = crypto
      .createHmac('sha256', config.apiSecret || '')
      .update(serialized)
      .digest('hex');
    return { serialized, signature };
  }

  async function createPayment(context = {}) {
    const payload = buildPaymentEnvelope(context);
    const { serialized, signature } = signPayload(payload);
    const headers = buildHeaders(signature);
    const url = buildRequestUrl(config.apiBase, config.createPaymentPath);

    if (!config.apiBase) {
      return {
        ok: false,
        status: 'not_configured',
        code: 'api_base_missing',
        payload,
        serialized,
        signature,
        message: 'OZON_BANK_API_BASE is not configured.',
      };
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: serialized,
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));

      const text = await response.text();
      const parsed = tryParseJson(text);
      const paymentUrl =
        typeof config.paymentUrlExtractor === 'function'
          ? config.paymentUrlExtractor(parsed)
          : extractField(parsed, config.paymentUrlField);

      const result = {
        ok: response.ok,
        status: response.ok ? 'pending' : 'error',
        payload,
        serialized,
        signature,
        response: parsed ?? text ?? null,
        paymentUrl: paymentUrl ?? null,
        httpStatus: response.status,
      };

      if (!response.ok) {
        return {
          ...result,
          code: 'http_error',
        };
      }

      return result;
    } catch (error) {
      return {
        ok: false,
        status: 'error',
        code: 'network_error',
        payload,
        serialized,
        signature,
        response: serializeError(error),
      };
    }
  }

  function verifyWebhookSignature(rawBody, providedSignature) {
    if (!config.webhookSecret) return false;
    const expected = crypto
      .createHmac('sha256', config.webhookSecret)
      .update(rawBody || '')
      .digest();

    const signatureBuffer = Buffer.from(providedSignature || '', 'hex');

    if (expected.length !== signatureBuffer.length) return false;

    return crypto.timingSafeEqual(expected, signatureBuffer);
  }

  function extractWebhookOrderId(payload) {
    const extracted = extractField(payload, config.webhookOrderField);
    if (extracted != null && extracted !== '') {
      return String(extracted);
    }
    if (payload && typeof payload === 'object') {
      return (
        payload.order_id ??
        payload.orderId ??
        payload.id ??
        payload.order?.id ??
        null
      );
    }
    return null;
  }

  function extractWebhookStatus(payload) {
    const extracted = extractField(payload, config.webhookStatusField);
    if (extracted != null && extracted !== '') {
      return String(extracted);
    }
    if (payload && typeof payload === 'object') {
      return payload.status ?? payload.state ?? payload.event ?? null;
    }
    return null;
  }

  function buildHeaders(signature) {
    const headers = {
      'Content-Type': 'application/json',
      ...config.staticHeaders,
    };

    if (config.signatureHeader && signature) {
      headers[config.signatureHeader] = signature;
    }
    if (config.merchantId) {
      headers['x-merchant-id'] = config.merchantId;
    }
    return headers;
  }

  return {
    config,
    buildPaymentEnvelope,
    signPayload,
    createPayment,
    verifyWebhookSignature,
    extractWebhookOrderId,
    extractWebhookStatus,
  };
}

function canonicalStringify(input) {
  if (input === null || typeof input !== 'object') {
    return JSON.stringify(input);
  }

  if (Array.isArray(input)) {
    const normalized = input.map((item) => JSON.parse(canonicalStringify(item)));
    return JSON.stringify(normalized);
  }

  const sortedKeys = Object.keys(input).sort();
  const normalizedObj = {};
  for (const key of sortedKeys) {
    normalizedObj[key] = JSON.parse(canonicalStringify(input[key]));
  }
  return JSON.stringify(normalizedObj);
}

function tryParseJson(text) {
  if (typeof text !== 'string' || !text) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
}

function serializeError(error) {
  if (!error) return null;
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
      name: error.name,
    };
  }
  return { message: String(error) };
}

function extractField(payload, fieldPath) {
  if (!fieldPath) return null;
  const pathParts = String(fieldPath)
    .split('.')
    .map((part) => part.trim())
    .filter(Boolean);
  if (!pathParts.length) return null;

  let current = payload;
  for (const part of pathParts) {
    if (current === null || current === undefined) return null;
    if (typeof current !== 'object') return null;
    current = current[part];
  }
  return current ?? null;
}

function normalizePath(path) {
  if (typeof path !== 'string') return '';
  const trimmed = path.trim();
  if (!trimmed) return '';
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

function trimTrailingSlash(url) {
  if (typeof url !== 'string') return '';
  return url.replace(/\/+$/, '');
}

function buildRequestUrl(base, path) {
  if (!base) return '';
  const normalizedBase = trimTrailingSlash(base);
  const normalizedPath = normalizePath(path);
  return `${normalizedBase}${normalizedPath}`;
}
