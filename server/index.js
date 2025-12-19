import 'dotenv/config';
import express from 'express';
import crypto from 'node:crypto';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import { sendVerificationEmail, sendPasswordResetEmail } from './emailClient.mjs';
import {
  searchPvz as searchDeliveryPvz,
  calculate as calculateDelivery,
  listTariffs as listDeliveryTariffs,
} from './delivery/index.mjs';

const requiredEnv = ['DATABASE_URL'];
const missingEnv = requiredEnv.filter((key) => !process.env[key]);

if (missingEnv.length > 0) {
  console.error(`Missing required env variables: ${missingEnv.join(', ')}`);
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const PORT = Number(process.env.PORT) || 3000;
const DEFAULT_FRONTEND_ORIGINS = ['https://автосиликон.рф', 'https://www.автосиликон.рф'];
const ALLOWED_ORIGINS = (() => {
  const raw = process.env.FRONTEND_ORIGIN;
  const parsed = typeof raw === 'string'
    ? raw
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    : [];

  if (parsed.length > 0) return parsed;

  if (process.env.NODE_ENV === 'production') return DEFAULT_FRONTEND_ORIGINS;

  return [...DEFAULT_FRONTEND_ORIGINS, `http://localhost:${5173}`];
})();
const emailVerifyTtlMin = Number(process.env.EMAIL_VERIFY_TTL_MIN ?? 15);
const passwordResetTtlMin = Number(process.env.PASSWORD_RESET_TTL_MIN ?? 30);
const emailVerifyTtlMs = minutesToMs(emailVerifyTtlMin);
const passwordResetTtlMs = minutesToMs(passwordResetTtlMin);
const throttleWindowMs = 60 * 1000;

const sessions = new Map();
const verifyThrottleMap = new Map();
const resetThrottleMap = new Map();
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

function generateVerificationCode(len = 5) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = crypto.randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i += 1) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

const app = express();

app.use((req, res, next) => {
  setCors(req, res);
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }
  next();
});

app.use(express.json());

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && 'body' in err) {
    sendJson(res, 400, { message: 'Невалидный JSON в теле запроса.' });
    return;
  }
  next(err);
});

app.get('/health*', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ ok: true }));
  } catch (error) {
    res.status(500).setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ ok: false, error: 'db_unreachable' }));
  }
});

const authRouter = express.Router();

authRouter.post('/register', (req, res) => handleRegister(req, res));
authRouter.post('/login', (req, res) => handleLogin(req, res));
authRouter.get('/me', (req, res) => handleCurrentUser(req, res));
authRouter.post('/send-verify-code', (req, res) => handleSendVerifyCode(req, res));
authRouter.post('/verify-email', (req, res) => handleVerifyEmail(req, res));
authRouter.post('/request-password-reset', (req, res) => handleRequestPasswordReset(req, res));
authRouter.post('/reset-password', (req, res) => handleResetPassword(req, res));

app.use('/api/auth', authRouter);

app.post('/api/delivery/pvz/search', (req, res) => {
  const requestUrl = new URL(req.originalUrl ?? req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  return handleDeliveryPvzSearch(req, res, requestUrl);
});

app.post('/api/delivery/calculate', (req, res) => handleDeliveryCalculate(req, res));
app.post('/api/delivery/tariffs', (req, res) => handleDeliveryTariffs(req, res));
app.put('/api/users/me/name', (req, res) => handleUpdateName(req, res));
app.post('/api/orders', (req, res) => handleCreateOrder(req, res));
app.get('/api/orders', (req, res) => handleGetOrders(req, res));

app.use((req, res) => {
  sendJson(res, 404, { message: 'Not found' });
});

const server = app.listen(PORT, () => {
  console.log(`Auth backend is listening on port ${PORT}`);
});

process.on('SIGINT', async () => {
  await pool.end();
  process.exit(0);
});

async function handleRegister(req, res) {
  try {
    const payload = await readJsonBody(req);
    const email = sanitizeEmail(payload.email);
    const password = typeof payload.password === 'string' ? payload.password.trim() : '';

    if (!email || !password) {
      sendJson(res, 400, { message: 'Email и пароль обязательны.' });
      return;
    }

    if (password.length < 6) {
      sendJson(res, 400, { message: 'Пароль должен содержать не менее 6 символов.' });
      return;
    }

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rowCount > 0) {
      sendJson(res, 409, { message: 'Пользователь с таким email уже существует.' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const insertResult = await pool.query(
      `
        INSERT INTO users (email, password_hash)
        VALUES ($1, $2)
        RETURNING id, email, name, email_verified, bonus_balance
      `,
      [email, passwordHash],
    );

    const user = insertResult.rows[0];
    const token = createSession(user.id);

    sendJson(res, 201, buildAuthResponse(user, token));
  } catch (error) {
    if (isClientError(error)) {
      sendJson(res, 400, { message: error.message });
      return;
    }
    handleServerError(res, error);
  }
}

async function handleLogin(req, res) {
  try {
    const payload = await readJsonBody(req);
    const email = sanitizeEmail(payload.email);
    const password = typeof payload.password === 'string' ? payload.password.trim() : '';

    if (!email || !password) {
      sendJson(res, 400, { message: 'Email и пароль обязательны.' });
      return;
    }

    const queryResult = await pool.query('SELECT id, email, password_hash, name, email_verified, bonus_balance FROM users WHERE email = $1', [email]);

    if (queryResult.rowCount === 0) {
      sendJson(res, 401, { message: 'Неверный email или пароль.' });
      return;
    }

    const user = queryResult.rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      sendJson(res, 401, { message: 'Неверный email или пароль.' });
      return;
    }

    const token = createSession(user.id);
    sendJson(res, 200, buildAuthResponse(user, token));
  } catch (error) {
    if (isClientError(error)) {
      sendJson(res, 400, { message: error.message });
      return;
    }
    handleServerError(res, error);
  }
}

async function handleCurrentUser(req, res) {
  try {
    const user = await getAuthenticatedUser(req, res);
    if (!user) {
      return;
    }

    sendJson(res, 200, buildAuthResponse(user));
  } catch (error) {
    handleServerError(res, error);
  }
}

async function handleSendVerifyCode(req, res) {
  try {
    const user = await getAuthenticatedUser(req, res, { includeSensitive: true });
    if (!user) return;

    if (user.email_verified) {
      sendJson(res, 400, { message: 'Email уже подтверждён.' });
      return;
    }

    if (isThrottled(verifyThrottleMap, `verify:${user.id}`)) {
      sendJson(res, 429, { message: 'Слишком много запросов. Попробуйте позже.' });
      return;
    }

    const verifyToken = generateVerificationCode(5);
    const expiresAt = new Date(Date.now() + emailVerifyTtlMs);

    await pool.query(
      `
        UPDATE users
        SET email_verification_token = $1,
            email_verification_expires = $2,
            updated_at = NOW()
        WHERE id = $3
      `,
      [verifyToken, expiresAt.toISOString(), user.id],
    );

    try {
      await sendVerificationEmail(user.email, verifyToken);
    } catch (emailError) {
      console.error('Не удалось отправить письмо MailerSend (verify):', emailError);
      sendJson(res, 500, { message: 'Не удалось отправить письмо с кодом. Попробуйте позже.' });
      return;
    }

    sendJson(res, 200, { success: true });
  } catch (error) {
    handleServerError(res, error);
  }
}

async function handleVerifyEmail(req, res) {
  try {
    const payload = await readJsonBody(req);
    const token = typeof payload.token === 'string' ? payload.token.trim() : '';
    if (!token) {
      sendJson(res, 400, { error: 'invalid_or_expired' });
      return;
    }

    const result = await pool.query(
      `
        SELECT id, email_verification_expires
        FROM users
        WHERE email_verification_token = $1
      `,
      [token],
    );

    if (result.rowCount === 0) {
      sendJson(res, 400, { error: 'invalid_or_expired' });
      return;
    }

    const user = result.rows[0];
    if (!user.email_verification_expires || new Date(user.email_verification_expires).getTime() < Date.now()) {
      sendJson(res, 400, { error: 'invalid_or_expired' });
      return;
    }

    await pool.query(
      `
        UPDATE users
        SET email_verified = true,
            email_verification_token = NULL,
            email_verification_expires = NULL,
            updated_at = NOW()
        WHERE id = $1
      `,
      [user.id],
    );

    sendJson(res, 200, { success: true });
  } catch (error) {
    handleServerError(res, error);
  }
}

async function handleRequestPasswordReset(req, res) {
  try {
    const payload = await readJsonBody(req);
    const email = sanitizeEmail(payload.email);

    if (!email) {
      sendJson(res, 200, { success: true });
      return;
    }

    if (isThrottled(resetThrottleMap, `reset:${email}`)) {
      sendJson(res, 200, { success: true });
      return;
    }

    const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [email]);

    if (userResult.rowCount > 0) {
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + passwordResetTtlMs);
      await pool.query(
        `
          UPDATE users
          SET reset_token = $1,
              reset_token_expires = $2,
              updated_at = NOW()
          WHERE id = $3
        `,
        [token, expiresAt.toISOString(), userResult.rows[0].id],
      );

      try {
        await sendPasswordResetEmail(email, token);
      } catch (emailError) {
        console.error('Не удалось отправить письмо MailerSend (reset):', emailError);
        sendJson(res, 500, { message: 'Не удалось отправить письмо для сброса пароля.' });
        return;
      }
    }

    sendJson(res, 200, { success: true });
  } catch (error) {
    handleServerError(res, error);
  }
}

async function handleResetPassword(req, res) {
  try {
    const payload = await readJsonBody(req);
    const token = typeof payload.token === 'string' ? payload.token.trim() : '';
    const newPassword = typeof payload.newPassword === 'string' ? payload.newPassword.trim() : '';

    if (!token || newPassword.length < 6) {
      sendJson(res, 400, { error: 'invalid_or_expired' });
      return;
    }

    const userResult = await pool.query(
      'SELECT id, reset_token_expires FROM users WHERE reset_token = $1',
      [token],
    );

    if (userResult.rowCount === 0) {
      sendJson(res, 400, { error: 'invalid_or_expired' });
      return;
    }

    const user = userResult.rows[0];
    if (!user.reset_token_expires || new Date(user.reset_token_expires).getTime() < Date.now()) {
      sendJson(res, 400, { error: 'invalid_or_expired' });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await pool.query(
      `
        UPDATE users
        SET password_hash = $1,
            reset_token = NULL,
            reset_token_expires = NULL,
            updated_at = NOW()
        WHERE id = $2
      `,
      [passwordHash, user.id],
    );

    sendJson(res, 200, { success: true });
  } catch (error) {
    handleServerError(res, error);
  }
}

async function handleDeliveryPvzSearch(req, res, requestUrl) {
  try {
    const payload = await readJsonBody(req);
    const provider = payload?.provider;
    if (!provider) {
      sendJson(res, 400, { message: 'Провайдер обязателен.' });
      return;
    }

    const modeFromQuery = requestUrl?.searchParams?.get('mode');
    const mode = modeFromQuery ?? payload?.mode ?? 'pickup';

    const points = await searchDeliveryPvz({
      provider,
      query: payload?.query,
      city: payload?.city,
      lat: payload?.lat,
      lon: payload?.lon,
      mode,
    });

    sendJson(res, 200, { points });
  } catch (error) {
    if (isClientError(error)) {
      sendJson(res, 400, { message: error.message });
      return;
    }
    handleServerError(res, error);
  }
}

async function handleDeliveryCalculate(req, res) {
  try {
    const payload = await readJsonBody(req);
    const { provider, type, total_weight, pickup_point_id, address, provider_metadata } = payload ?? {};

    if (!provider || !type) {
      sendJson(res, 400, { message: 'Провайдер и тип доставки обязательны.' });
      return;
    }
    const weight = Number(total_weight);
    if (!Number.isFinite(weight) || weight <= 0) {
      sendJson(res, 400, { message: 'total_weight должен быть больше нуля.' });
      return;
    }

    if (type === 'pvz') {
      if (!pickup_point_id) {
        sendJson(res, 400, { message: 'pickup_point_id обязателен для ПВЗ.' });
        return;
      }
      if (address) {
        sendJson(res, 400, { message: 'address не используется для ПВЗ.' });
        return;
      }
    }

    if (type === 'door') {
      if (!address) {
        sendJson(res, 400, { message: 'address обязателен для доставки до двери.' });
        return;
      }
      if (pickup_point_id) {
        sendJson(res, 400, { message: 'pickup_point_id не используется для доставки до двери.' });
        return;
      }
    }

    const quote = await calculateDelivery({
      provider,
      type,
      total_weight: weight,
      pickup_point_id,
      address,
      provider_metadata,
    });

    sendJson(res, 200, quote);
  } catch (error) {
    const error_code = extractErrorCode(error);
    const detail = extractErrorDetail(error);
    if (isClientError(error)) {
      sendJson(res, 400, {
        message: error.message,
        ...(error_code != null ? { error_code } : {}),
        ...(detail != null ? { detail } : {}),
      });
      return;
    }
    if (isConfigError(error)) {
      sendJson(res, 500, {
        message: error.message,
        ...(error_code != null ? { error_code } : {}),
        ...(detail != null ? { detail } : {}),
      });
      return;
    }
    sendJson(res, 500, {
      message: 'Не удалось рассчитать доставку.',
      ...(error_code != null ? { error_code } : {}),
      ...(detail != null ? { detail } : {}),
      error: String(error?.message ?? error),
    });
  }
}

async function handleDeliveryTariffs(req, res) {
  try {
    const payload = await readJsonBody(req);
    const { provider, type, total_weight, pickup_point_id, address, provider_metadata } = payload ?? {};

    if (!provider || !type) {
      sendJson(res, 400, { message: 'Провайдер и тип доставки обязательны.' });
      return;
    }

    const weight = Number(total_weight);
    if (!Number.isFinite(weight) || weight <= 0) {
      sendJson(res, 400, { message: 'total_weight должен быть больше нуля.' });
      return;
    }

    if (type === 'pvz') {
      if (!pickup_point_id) {
        sendJson(res, 400, { message: 'pickup_point_id обязателен для ПВЗ.' });
        return;
      }
      if (address) {
        sendJson(res, 400, { message: 'address не используется для ПВЗ.' });
        return;
      }
    }

    if (type === 'door') {
      if (!address) {
        sendJson(res, 400, { message: 'address обязателен для доставки до двери.' });
        return;
      }
      if (pickup_point_id) {
        sendJson(res, 400, { message: 'pickup_point_id не используется для доставки до двери.' });
        return;
      }
    }

    const tariffs = await listDeliveryTariffs({
      provider,
      type,
      total_weight: weight,
      pickup_point_id,
      address,
      provider_metadata,
    });

    sendJson(res, 200, { tariffs });
  } catch (error) {
    const error_code = extractErrorCode(error);
    const detail = extractErrorDetail(error);
    if (isClientError(error)) {
      sendJson(res, 400, {
        message: error.message,
        ...(error_code != null ? { error_code } : {}),
        ...(detail != null ? { detail } : {}),
      });
      return;
    }
    if (isConfigError(error)) {
      sendJson(res, 500, {
        message: error.message,
        ...(error_code != null ? { error_code } : {}),
        ...(detail != null ? { detail } : {}),
      });
      return;
    }
    sendJson(res, 500, {
      message: 'Не удалось получить список тарифов.',
      ...(error_code != null ? { error_code } : {}),
      ...(detail != null ? { detail } : {}),
      error: String(error?.message ?? error),
    });
  }
}

async function handleUpdateName(req, res) {
  try {
    const authUser = await getAuthenticatedUser(req, res);
    if (!authUser) return;

    const payload = await readJsonBody(req);
    const name = typeof payload.name === 'string' ? payload.name.trim() : '';

    if (!name || name.length > 100) {
      sendJson(res, 400, { message: 'Некорректное имя.' });
      return;
    }

    await pool.query(
      'UPDATE users SET name = $1, updated_at = NOW() WHERE id = $2',
      [name, authUser.id],
    );

    sendJson(res, 200, { success: true, name });
  } catch (error) {
    handleServerError(res, error);
  }
}

async function handleCreateOrder(req, res) {
  try {
    const authUser = await getAuthenticatedUser(req, res);
    if (!authUser) return;

    const payload = await readJsonBody(req);
    const order = payload?.order;
    const useBonuses = Boolean(payload?.useBonuses);

    if (!order || typeof order !== 'object' || Array.isArray(order) || !Object.keys(order).length) {
      sendJson(res, 400, { message: 'Некорректные данные заказа.' });
      return;
    }

    const totalWeight = extractTotalWeight(order);
    if (totalWeight === null) {
      sendJson(res, 400, { message: 'Вес корзины обязателен и должен быть больше нуля.' });
      return;
    }

    const deliveryPrice = extractDeliveryPrice(order);
    if (deliveryPrice === null) {
      sendJson(res, 400, { message: 'delivery_price обязателен и должен быть неотрицательным числом.' });
      return;
    }

    const deliveryInfo = validateDelivery(order?.delivery);
    if (!deliveryInfo.ok) {
      sendJson(res, 400, { message: deliveryInfo.error });
      return;
    }

    const itemsTotal = calculateOrderTotal(order);
    const fullOrderTotal = itemsTotal + deliveryPrice;
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const balanceResult = await client.query(
        'SELECT bonus_balance FROM users WHERE id = $1 FOR UPDATE',
        [authUser.id],
      );

      if (balanceResult.rowCount === 0) {
        await client.query('ROLLBACK');
        sendJson(res, 404, { message: 'Пользователь не найден.' });
        return;
      }

      const currentBalance = Number(balanceResult.rows[0].bonus_balance) || 0;
      const { usedBonus, bonusEarned, payable, newBalance } = calculateBonuses({
        orderTotal: fullOrderTotal,
        bonusBalance: currentBalance,
        useBonuses,
      });

      const orderPayload = enrichOrderData(order, {
        usedBonus,
        bonusEarned,
        payable,
        orderTotal: fullOrderTotal,
        newBalance,
      }, { totalWeight, deliveryPrice, delivery: deliveryInfo.value, itemsTotal });

      const insertResult = await client.query(
        `
          INSERT INTO order_history (user_id, order_data, bonus_spent, bonus_earned, payable_amount)
          VALUES ($1, $2::jsonb, $3, $4, $5)
          RETURNING id
        `,
        [authUser.id, JSON.stringify(orderPayload), usedBonus, bonusEarned, payable],
      );

      await client.query(
        `
          UPDATE users
          SET bonus_balance = $1,
              updated_at = NOW()
          WHERE id = $2
        `,
        [newBalance, authUser.id],
      );

      await client.query('COMMIT');

      sendJson(res, 200, {
        success: true,
        orderId: insertResult.rows[0]?.id ?? null,
        usedBonus,
        bonusEarned,
        payable,
        newBonusBalance: newBalance,
      });
    } catch (innerError) {
      await client.query('ROLLBACK');
      throw innerError;
    } finally {
      client.release();
    }
  } catch (error) {
    handleServerError(res, error);
  }
}

async function handleGetOrders(req, res) {
  try {
    const authUser = await getAuthenticatedUser(req, res);
    if (!authUser) return;

    const ordersResult = await pool.query(
      `
        SELECT id, order_data, created_at, bonus_spent, bonus_earned, payable_amount
        FROM order_history
        WHERE user_id = $1
        ORDER BY created_at DESC
      `,
      [authUser.id],
    );

    sendJson(res, 200, ordersResult.rows);
  } catch (error) {
    handleServerError(res, error);
  }
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return req.body;
  }

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const rawBody = Buffer.concat(chunks).toString();
  if (!rawBody) {
    return {};
  }
  try {
    return JSON.parse(rawBody);
  } catch (error) {
    throw new Error('Невалидный JSON в теле запроса.');
  }
}

function sanitizeEmail(value) {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase();
}

function setCors(req, res) {
  const origin = req.headers.origin;
  const isAllowedOrigin = typeof origin === 'string' && ALLOWED_ORIGINS.includes(origin);
  if (isAllowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

function handleServerError(res, error) {
  console.error('Auth API error:', error);
  sendJson(res, 500, { message: 'Внутренняя ошибка сервера.' });
}

function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { userId, createdAt: Date.now() });
  return token;
}

function getSession(token) {
  const session = sessions.get(token);
  if (!session) {
    return null;
  }
  const isExpired = Date.now() - session.createdAt > SESSION_TTL_MS;
  if (isExpired) {
    sessions.delete(token);
    return null;
  }
  return session;
}

async function getAuthenticatedUser(req, res, options = {}) {
  const token = extractToken(req.headers['authorization']);
  if (!token) {
    sendJson(res, 401, { message: 'Требуется аутентификация.' });
    return null;
  }

  const session = getSession(token);
  if (!session) {
    sendJson(res, 401, { message: 'Сессия недействительна или устарела.' });
    return null;
  }

  const fields = options.includeSensitive
    ? '*'
    : 'id, email, name, email_verified, bonus_balance';
  const userResult = await pool.query(`SELECT ${fields} FROM users WHERE id = $1`, [session.userId]);

  if (userResult.rowCount === 0) {
    sessions.delete(token);
    sendJson(res, 401, { message: 'Пользователь не найден.' });
    return null;
  }

  return userResult.rows[0];
}

function extractToken(headerValue) {
  if (typeof headerValue !== 'string') return null;
  const parts = headerValue.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }
  return parts[1];
}

function isClientError(error) {
  return (
    error instanceof Error &&
    (/Невалидный JSON/.test(error.message) ||
      /^(RUSPOST|CDEK):/i.test(error.message) ||
      /обязател|недопустим|не удалось/i.test(error.message))
  );
}

function extractErrorDetail(error) {
  if (!error || typeof error !== 'object') return null;
  return error.detail ?? null;
}

function isConfigError(error) {
  if (!(error instanceof Error)) return false;
  return /не задан в окружении/i.test(error.message) || /^RUSPOST_ACCEPTANCE_INDEX\b/.test(error.message);
}

function extractErrorCode(error) {
  if (!error || typeof error !== 'object') return null;
  const candidate = error.error_code ?? error.errorCode ?? error.code ?? null;
  if (candidate == null) return null;
  const numeric = typeof candidate === 'number' ? candidate : Number(String(candidate).trim());
  return Number.isFinite(numeric) ? numeric : null;
}

function minutesToMs(value) {
  return Number(value) * 60 * 1000;
}

function buildAuthResponse(user, token) {
  return {
    id: String(user.id),
    email: user.email,
    name: user.name ?? null,
    email_verified: Boolean(user.email_verified),
    bonus_balance: Number(user.bonus_balance) || 0,
    ...(token ? { token } : {}),
  };
}

function isThrottled(map, key) {
  const last = map.get(key) ?? 0;
  if (Date.now() - last < throttleWindowMs) {
    return true;
  }
  map.set(key, Date.now());
  return false;
}

function calculateOrderTotal(order) {
  if (!order || typeof order !== 'object') return 0;

  if (Array.isArray(order.items)) {
    return order.items.reduce((sum, item) => {
      if (!item || typeof item !== 'object') return sum;
      const priceAmount = Number(item?.price?.amount);
      const quantity = Number(item?.quantity);
      if (!Number.isFinite(priceAmount) || !Number.isFinite(quantity)) return sum;
      const sanitizedPrice = Math.max(0, Math.floor(priceAmount));
      const sanitizedQty = Math.max(0, Math.floor(quantity));
      return sum + sanitizedPrice * sanitizedQty;
    }, 0);
  }

  const fallbackTotal = Number(order?.total?.amount);
  if (Number.isFinite(fallbackTotal)) {
    return Math.max(0, Math.floor(fallbackTotal));
  }
  return 0;
}

function extractDeliveryPrice(order) {
  if (!order || typeof order !== 'object') return null;
  const raw = order.delivery_price ?? order.deliveryPrice ?? order.delivery?.price;
  const numeric = typeof raw === 'string' ? Number.parseFloat(raw) : Number(raw ?? NaN);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return null;
  }
  return numeric;
}

function extractTotalWeight(order) {
  if (!order || typeof order !== 'object') return null;
  const rawWeight = order.total_weight ?? order.totalWeight;
  const numeric =
    typeof rawWeight === 'string' ? Number.parseFloat(rawWeight) : Number(rawWeight ?? NaN);
  if (!Number.isFinite(numeric)) return null;
  const normalized = Number(numeric);
  if (normalized <= 0) return null;
  return normalized;
}

function calculateBonuses({ orderTotal, bonusBalance, useBonuses }) {
  const safeOrderTotal = Math.max(0, Math.floor(Number(orderTotal) || 0));
  const safeBalance = Math.max(0, Math.floor(Number(bonusBalance) || 0));
  const useBonusFlag = Boolean(useBonuses);

  const usedBonus = useBonusFlag ? Math.min(safeBalance, safeOrderTotal) : 0;
  const payable = safeOrderTotal - usedBonus;
  const bonusEarned = useBonusFlag ? 0 : Math.floor(safeOrderTotal * 0.02);
  const newBalance = useBonusFlag ? safeBalance - usedBonus : safeBalance + bonusEarned;

  return { usedBonus, bonusEarned, payable, newBalance };
}

function enrichOrderData(order, bonusPayload, meta = {}) {
  const existing = order && typeof order === 'object' ? order : {};
  const totalAmount = Number(meta?.itemsTotal ?? calculateOrderTotal(order));
  const totalWeight =
    typeof meta?.totalWeight === 'number' && Number.isFinite(meta.totalWeight)
      ? meta.totalWeight
      : extractTotalWeight(order);
  const deliveryPrice =
    typeof meta?.deliveryPrice === 'number' && Number.isFinite(meta.deliveryPrice)
      ? meta.deliveryPrice
      : extractDeliveryPrice(order);

  const payload = {
    ...existing,
    total: order?.total ?? { amount: totalAmount, currency: 'RUB' },
    delivery_price: deliveryPrice ?? 0,
    delivery_status: existing.delivery_status ?? 'created',
    delivery: meta?.delivery ?? existing.delivery,
    bonus: {
      spent: bonusPayload.usedBonus,
      earned: bonusPayload.bonusEarned,
      payable: bonusPayload.payable,
      balanceAfter: bonusPayload.newBalance,
      orderTotal: bonusPayload.orderTotal,
    },
  };

  if (typeof totalWeight === 'number' && Number.isFinite(totalWeight)) {
    payload.total_weight = totalWeight;
  }

  if (deliveryPrice !== undefined && deliveryPrice !== null) {
    payload.delivery_price = deliveryPrice;
  }

  return payload;
}

function validateDelivery(rawDelivery) {
  const delivery = rawDelivery && typeof rawDelivery === 'object' ? rawDelivery : null;
  if (!delivery) {
    return { ok: false, error: 'delivery обязателен.' };
  }

  const provider = typeof delivery.provider === 'string' ? delivery.provider : '';
  const type = typeof delivery.type === 'string' ? delivery.type : '';
  if (!provider || !type) {
    return { ok: false, error: 'provider и type в delivery обязательны.' };
  }

  const allowedProviders = ['cdek', 'ruspost'];
  if (!allowedProviders.includes(provider)) {
    return { ok: false, error: 'Недопустимый провайдер доставки.' };
  }

  const allowedTypes = ['pvz', 'door'];
  if (!allowedTypes.includes(type)) {
    return { ok: false, error: 'Недопустимый тип доставки.' };
  }

  if (type === 'pvz' && !delivery.pickup_point_id) {
    return { ok: false, error: 'pickup_point_id обязателен для ПВЗ.' };
  }
  if (type === 'door') {
    const addr = delivery.address;
    if (!addr || typeof addr !== 'object') {
      return { ok: false, error: 'address обязателен для доставки до двери.' };
    }
  }

  return { ok: true, value: delivery };
}
