import crypto from 'node:crypto';

export function normalizeAlfaBankConfig(source = process.env) {
  const env = source ?? {};
  const pick = (key, fallback = '') =>
    typeof env[key] === 'string' ? env[key].trim() : fallback;

  const timeoutMs = Number(env.ALFA_TIMEOUT_MS ?? 15000);

  return {
    apiBase: trimTrailingSlash(pick('ALFA_API_BASE') || pick('ALFA_REST_BASE')),
    registerPath: normalizePath(pick('ALFA_REGISTER_PATH')) || '/register.do',
    userName: pick('ALFA_USER_NAME') || pick('ALFA_USERNAME'),
    password: pick('ALFA_PASSWORD'),
    token: pick('ALFA_TOKEN'),
    returnUrl: pick('PAYMENT_SUCCESS_URL') || pick('ALFA_RETURN_URL'),
    failUrl: pick('PAYMENT_FAIL_URL') || pick('ALFA_FAIL_URL'),
    callbackUrl: pick('ALFA_CALLBACK_URL') || pick('ALFA_DYNAMIC_CALLBACK_URL'),
    language: pick('ALFA_LANGUAGE') || 'ru',
    currency: pick('ALFA_CURRENCY_CODE'),
    timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : 15000,
    callbackSecret: pick('ALFA_CALLBACK_SECRET') || pick('ALFA_WEBHOOK_SECRET'),
  };
}

export function createAlfaBankAdapter(userConfig = {}) {
  const config = {
    ...normalizeAlfaBankConfig(),
    ...(userConfig || {}),
  };

  function buildRegisterPayload(context = {}, options = {}) {
    const includeCurrency = options.includeCurrency !== false;
    const orderNumber = String(context.orderNumber ?? context.orderId ?? context.id ?? '').trim();
    const amountMinor = toMinorAmount(context.amount);
    const currency =
      typeof context.currency === 'string' && context.currency.trim()
        ? context.currency.trim()
        : config.currency;

    const payload = {
      orderNumber,
      amount: amountMinor,
      currency: includeCurrency ? currency : null,
      returnUrl: config.returnUrl || null,
      failUrl: config.failUrl || null,
      language: config.language || 'ru',
      description: typeof context.description === 'string' ? context.description : null,
      clientId: context.clientId ?? null,
      dynamicCallbackUrl: config.callbackUrl || null,
    };

    if (config.token) {
      payload.token = config.token;
    } else {
      payload.userName = config.userName || null;
      payload.password = config.password || null;
    }

    return payload;
  }

  async function registerPayment(context = {}) {
    if (!config.apiBase) {
      return {
        ok: false,
        status: 'not_configured',
        code: 'api_base_missing',
        message: 'ALFA_API_BASE is not configured.',
      };
    }

    const payload = buildRegisterPayload(context);

    const body = new URLSearchParams();
    Object.entries(payload).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') return;
      body.set(key, String(value));
    });

    const url = buildRequestUrl(config.apiBase, config.registerPath);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));

      const text = await response.text();
      const parsed = tryParseJson(text);

      const errorCode = extractField(parsed, 'errorCode');
      const errorMessage = extractField(parsed, 'errorMessage');
      const formUrl = extractField(parsed, 'formUrl');
      const gatewayOrderId = extractField(parsed, 'orderId');

      const isOk = response.ok && (errorCode == null || String(errorCode) === '0') && formUrl;

      const result = {
        ok: Boolean(isOk),
        status: isOk ? 'pending' : 'error',
        payload,
        response: parsed ?? text ?? null,
        paymentUrl: formUrl ?? null,
        gatewayOrderId: gatewayOrderId ?? null,
        errorCode: errorCode ?? null,
        errorMessage: errorMessage ?? null,
        httpStatus: response.status,
      };

      if (!response.ok) {
        return {
          ...result,
          code: 'http_error',
        };
      }

      if (!isOk) {
        if (
          String(errorCode ?? '') === '3' &&
          typeof errorMessage === 'string' &&
          errorMessage.toLowerCase().includes('валют')
        ) {
          // Some Alfa test merchants reject explicit currency and expect merchant default.
          return requestRegister(buildRegisterPayload(context, { includeCurrency: false }));
        }
        return {
          ...result,
          code: errorCode != null ? 'api_error' : 'http_error',
        };
      }

      return result;
    } catch (error) {
      return {
        ok: false,
        status: 'error',
        code: 'network_error',
        payload,
        response: serializeError(error),
      };
    }
  }

  async function requestRegister(payload) {
    const body = new URLSearchParams();
    Object.entries(payload).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') return;
      body.set(key, String(value));
    });

    const url = buildRequestUrl(config.apiBase, config.registerPath);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));

      const text = await response.text();
      const parsed = tryParseJson(text);

      const errorCode = extractField(parsed, 'errorCode');
      const errorMessage = extractField(parsed, 'errorMessage');
      const formUrl = extractField(parsed, 'formUrl');
      const gatewayOrderId = extractField(parsed, 'orderId');

      const isOk = response.ok && (errorCode == null || String(errorCode) === '0') && formUrl;

      const result = {
        ok: Boolean(isOk),
        status: isOk ? 'pending' : 'error',
        payload,
        response: parsed ?? text ?? null,
        paymentUrl: formUrl ?? null,
        gatewayOrderId: gatewayOrderId ?? null,
        errorCode: errorCode ?? null,
        errorMessage: errorMessage ?? null,
        httpStatus: response.status,
      };

      if (!response.ok) {
        return {
          ...result,
          code: 'http_error',
        };
      }

      if (!isOk) {
        return {
          ...result,
          code: errorCode != null ? 'api_error' : 'http_error',
        };
      }

      return result;
    } catch (error) {
      return {
        ok: false,
        status: 'error',
        code: 'network_error',
        payload,
        response: serializeError(error),
      };
    }
  }

  function verifyCallbackSignature(rawBody, providedSignature) {
    if (!config.callbackSecret || !providedSignature) return false;
    const expected = crypto
      .createHmac('sha256', config.callbackSecret)
      .update(rawBody || '')
      .digest('hex')
      .toUpperCase();
    const normalized = String(providedSignature || '').toUpperCase();
    return expected === normalized;
  }

  return {
    config,
    registerPayment,
    buildRegisterPayload,
    verifyCallbackSignature,
  };
}

function toMinorAmount(amount) {
  const numeric = Number(amount);
  if (!Number.isFinite(numeric) || numeric < 0) return 0;
  return Math.round(numeric * 100);
}

function buildRequestUrl(base, path) {
  const normalizedBase = trimTrailingSlash(base || '');
  const normalizedPath = normalizePath(path || '');
  if (!normalizedBase) return normalizedPath || '';
  if (!normalizedPath) return normalizedBase;
  return `${normalizedBase}${normalizedPath}`;
}

function normalizePath(path) {
  if (!path) return '';
  return path.startsWith('/') ? path : `/${path}`;
}

function trimTrailingSlash(value) {
  return typeof value === 'string' ? value.replace(/\/+$/, '') : '';
}

function tryParseJson(text) {
  if (!text || typeof text !== 'string') return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function extractField(payload, path) {
  if (!payload || typeof payload !== 'object') return null;
  if (!path) return null;
  const segments = String(path).split('.');
  let current = payload;
  for (const segment of segments) {
    if (!current || typeof current !== 'object') return null;
    current = current[segment];
  }
  return current ?? null;
}

function serializeError(error) {
  if (!error) return null;
  if (error instanceof Error) {
    return { message: error.message, stack: error.stack };
  }
  return { message: String(error) };
}
