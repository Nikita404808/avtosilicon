import 'dotenv/config';
import express from 'express';
import crypto from 'node:crypto';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import { sendVerificationEmail, sendPasswordResetEmail } from './emailClient.mjs';
import { createOzonBankAdapter, normalizeOzonBankConfig } from './payments/ozonBankAdapter.mjs';
import { createAlfaBankAdapter, normalizeAlfaBankConfig } from './payments/alfaBankAdapter.mjs';
import {
  searchPvz as searchDeliveryPvz,
  calculate as calculateDelivery,
  listTariffs as listDeliveryTariffs,
  createShipment as createDeliveryShipment,
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
const OZON_PAYMENT_PROVIDER = 'ozon_bank';
const ALFA_PAYMENT_PROVIDER = 'alfa_bank';
const PAYMENT_PROVIDER = (process.env.PAYMENT_PROVIDER || ALFA_PAYMENT_PROVIDER).trim();

const ozonBankConfig = normalizeOzonBankConfig(process.env);
const ozonBankAdapter = createOzonBankAdapter(ozonBankConfig);
const ozonConfigIssues = collectOzonPaymentConfigIssues(ozonBankConfig);
if (PAYMENT_PROVIDER === OZON_PAYMENT_PROVIDER && ozonConfigIssues.length > 0) {
  console.warn(
    `OZON Bank config is incomplete: ${ozonConfigIssues.join(', ')}`,
  );
}

const alfaBankConfig = normalizeAlfaBankConfig(process.env);
const alfaBankAdapter = createAlfaBankAdapter(alfaBankConfig);
const alfaConfigIssues = collectAlfaPaymentConfigIssues(alfaBankConfig);
if (PAYMENT_PROVIDER === ALFA_PAYMENT_PROVIDER && alfaConfigIssues.length > 0) {
  console.warn(
    `Alfa Bank config is incomplete: ${alfaConfigIssues.join(', ')}`,
  );
}
const emailVerifyTtlMin = Number(process.env.EMAIL_VERIFY_TTL_MIN ?? 15);
const passwordResetTtlMin = Number(process.env.PASSWORD_RESET_TTL_MIN ?? 30);
const emailVerifyTtlMs = minutesToMs(emailVerifyTtlMin);
const passwordResetTtlMs = minutesToMs(passwordResetTtlMin);
const throttleWindowMs = 60 * 1000;

const sessions = new Map();
const verifyThrottleMap = new Map();
const resetThrottleMap = new Map();
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

try {
  await ensureOrderPaymentColumns();
  await ensureUsersPhoneColumn();
} catch (error) {
  process.exit(1);
}

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

app.use(express.json({ verify: rawBodySaver }));
app.use(express.urlencoded({ extended: false, verify: rawBodySaver }));

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && 'body' in err) {
    sendJson(res, 400, { message: 'Невалидный JSON в теле запроса.' });
    return;
  }
  next(err);
});

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'db_unreachable' });
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
app.get('/api/users/me', (req, res) => handleCurrentUser(req, res));
app.get('/api/users/me/addresses', (req, res) => handleGetUserAddresses(req, res));
app.post('/api/users/me/addresses', (req, res) => handleAddUserAddress(req, res));
app.post('/api/users/me/addresses/session', (req, res) => handleAddressSession(req, res));
app.put('/api/users/me/name', (req, res) => handleUpdateName(req, res));
app.put('/api/users/me/phone', (req, res) => handleUpdatePhone(req, res));
app.post('/api/orders', (req, res) => handleCreateOrder(req, res));
app.get('/api/orders', (req, res) => handleGetOrders(req, res));
app.post('/api/payments/ozon/webhook', (req, res) => handleOzonWebhook(req, res));
app.all('/api/payments/alfa/callback', (req, res) => handleAlfaCallback(req, res));

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

    const queryResult = await pool.query(
      'SELECT id, email, password_hash, name, phone, email_verified, bonus_balance FROM users WHERE email = $1',
      [email],
    );

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

async function handleUpdatePhone(req, res) {
  try {
    const authUser = await getAuthenticatedUser(req, res);
    if (!authUser) return;

    const payload = await readJsonBody(req);
    const rawPhone = typeof payload.phone === 'string' ? payload.phone.trim() : '';
    const digits = rawPhone.replace(/\D/g, '');

    if (!rawPhone) {
      await pool.query('UPDATE users SET phone = NULL, updated_at = NOW() WHERE id = $1', [
        authUser.id,
      ]);
      sendJson(res, 200, { success: true, phone: null });
      return;
    }

    if (digits.length < 10 || digits.length > 15) {
      sendJson(res, 400, { message: 'Некорректный телефон.' });
      return;
    }

    await pool.query('UPDATE users SET phone = $1, updated_at = NOW() WHERE id = $2', [
      rawPhone,
      authUser.id,
    ]);

    sendJson(res, 200, { success: true, phone: rawPhone });
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
      const { usedBonus, bonusEarned, payable } = calculateBonuses({
        orderTotal: fullOrderTotal,
        bonusBalance: currentBalance,
        useBonuses,
      });
      const reservedBalance = usedBonus > 0
        ? Math.max(0, currentBalance - usedBonus)
        : currentBalance;

      const paymentDraft = {
        provider: PAYMENT_PROVIDER,
        status: 'pending',
        payable_amount: payable,
        payment_url: null,
        payload: null,
        response: null,
        webhook: null,
      };

      const orderPayload = enrichOrderData(order, {
        usedBonus,
        bonusEarned,
        payable,
        orderTotal: fullOrderTotal,
        newBalance: reservedBalance,
      }, { totalWeight, deliveryPrice, delivery: deliveryInfo.value, itemsTotal });
      orderPayload.payment = paymentDraft;
      orderPayload.status = orderPayload.status ?? 'processing';
      orderPayload.bonus = {
        ...(orderPayload.bonus && typeof orderPayload.bonus === 'object' ? orderPayload.bonus : {}),
        spentReserved: usedBonus > 0,
        spentRestoredAt: null,
        earnedAppliedAt: null,
      };

      const insertResult = await client.query(
        `
          INSERT INTO order_history (user_id, order_data, bonus_spent, bonus_earned, payable_amount)
          VALUES ($1, $2::jsonb, $3, $4, $5)
          RETURNING id
        `,
        [authUser.id, JSON.stringify(orderPayload), usedBonus, bonusEarned, payable],
      );

      if (usedBonus > 0) {
        await client.query(
          `
            UPDATE users
            SET bonus_balance = $1,
                updated_at = NOW()
            WHERE id = $2
          `,
          [reservedBalance, authUser.id],
        );
      }

      await client.query('COMMIT');

      const orderId = insertResult.rows[0]?.id ?? null;
      if (!orderId) {
        sendJson(res, 500, { message: 'Не удалось создать заказ.' });
        return;
      }

      const paymentInit = await initiatePayment(orderId, payable, orderPayload, authUser);
      if (!paymentInit.ok) {
        const sideEffectResult = await applyPaymentOutcomeEffects(
          orderId,
          paymentInit.status ?? 'error',
        );
        if (!sideEffectResult.ok) {
          console.error('Failed to apply payment side effects after init error', {
            orderId,
            code: sideEffectResult.code,
          });
        }
        sendJson(res, paymentInit.httpStatus ?? 502, {
          success: false,
          orderId,
          message: 'Ошибка оплаты, попробуйте позже.',
          payment_status: paymentInit.status ?? null,
        });
        return;
      }

      sendJson(res, 200, {
        success: true,
        orderId,
        usedBonus,
        bonusEarned,
        payable,
        newBonusBalance: reservedBalance,
        payment_url: paymentInit.paymentUrl ?? null,
        payment_status: paymentInit.status ?? null,
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
        SELECT
          id,
          order_data,
          created_at,
          bonus_spent,
          bonus_earned,
          payable_amount,
          payment_provider,
          payment_status,
          payment_payload,
          payment_response,
          payment_webhook
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

async function handleGetUserAddresses(req, res) {
  const authUser = await getAuthenticatedUser(req, res);
  if (!authUser) return;
  sendJson(res, 200, []);
}

async function handleAddUserAddress(req, res) {
  const authUser = await getAuthenticatedUser(req, res);
  if (!authUser) return;
  const payload = await readJsonBody(req);
  const address = {
    id: `local-${Date.now()}`,
    label: payload?.label ?? payload?.addressLine ?? 'Адрес',
    isDefault: true,
    lastSyncedAt: new Date().toISOString(),
    details: payload ?? null,
  };
  sendJson(res, 200, address);
}

async function handleAddressSession(req, res) {
  const authUser = await getAuthenticatedUser(req, res);
  if (!authUser) return;
  sendJson(res, 200, { redirectUrl: null });
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
    : 'id, email, name, phone, email_verified, bonus_balance';
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
    phone: user.phone ?? null,
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

async function ensureOrderPaymentColumns() {
  try {
    await pool.query(`
      ALTER TABLE IF EXISTS order_history
        ADD COLUMN IF NOT EXISTS payment_provider TEXT,
        ADD COLUMN IF NOT EXISTS payment_status TEXT,
        ADD COLUMN IF NOT EXISTS payment_payload JSONB,
        ADD COLUMN IF NOT EXISTS payment_response JSONB,
        ADD COLUMN IF NOT EXISTS payment_webhook JSONB;
    `);
  } catch (error) {
    console.error('Failed to ensure payment columns:', error);
    throw error;
  }
}

async function ensureUsersPhoneColumn() {
  try {
    await pool.query(`
      ALTER TABLE IF EXISTS users
        ADD COLUMN IF NOT EXISTS phone TEXT;
    `);
  } catch (error) {
    console.error('Failed to ensure users phone column:', error);
    throw error;
  }
}

function rawBodySaver(req, res, buf) {
  req.rawBody = buf?.toString('utf8') ?? '';
}

function collectOzonPaymentConfigIssues(config) {
  const issues = [];
  if (!config?.merchantId) issues.push('OZON_BANK_MERCHANT_ID');
  if (!config?.apiSecret) issues.push('OZON_BANK_API_SECRET');
  if (!config?.webhookSecret) issues.push('OZON_BANK_WEBHOOK_SECRET');
  if (!config?.successUrl) issues.push('PAYMENT_SUCCESS_URL');
  if (!config?.failUrl) issues.push('PAYMENT_FAIL_URL');
  if (!config?.apiBase) issues.push('OZON_BANK_API_BASE');
  return issues;
}

function collectAlfaPaymentConfigIssues(config) {
  const issues = [];
  if (!config?.apiBase) issues.push('ALFA_API_BASE');
  if (!config?.returnUrl) issues.push('PAYMENT_SUCCESS_URL');
  if (!config?.failUrl) issues.push('PAYMENT_FAIL_URL');
  if (!config?.token && !config?.userName) issues.push('ALFA_USER_NAME');
  if (!config?.token && !config?.password) issues.push('ALFA_PASSWORD');
  return issues;
}

function resolvePaymentProvider() {
  const normalized = String(PAYMENT_PROVIDER || '').trim().toLowerCase();
  if (normalized === OZON_PAYMENT_PROVIDER) return OZON_PAYMENT_PROVIDER;
  return ALFA_PAYMENT_PROVIDER;
}

async function initiatePayment(orderId, payableAmount, orderPayload, user) {
  const provider = resolvePaymentProvider();
  if (provider === OZON_PAYMENT_PROVIDER) {
    return initiateOzonPayment(orderId, payableAmount, orderPayload, user);
  }
  return initiateAlfaPayment(orderId, payableAmount, orderPayload, user);
}

async function initiateOzonPayment(orderId, payableAmount, orderPayload, user) {
  try {
    const paymentResult = await ozonBankAdapter.createPayment({
      orderId,
      amount: payableAmount,
      currency: orderPayload?.total?.currency ?? 'RUB',
      description: `Order ${orderId}`,
      userId: user?.id ?? null,
      items: orderPayload?.items ?? null,
      extra: {
        delivery: orderPayload?.delivery ?? null,
        bonus: orderPayload?.bonus ?? null,
      },
      order: orderPayload,
    });

    const status = resolveNextPaymentStatus(
      'pending',
      paymentResult.status ?? (paymentResult.ok ? 'pending' : 'error'),
    );

    const persistResult = await persistPaymentSnapshot(orderId, {
      provider: OZON_PAYMENT_PROVIDER,
      status,
      payable_amount: payableAmount,
      payment_url: paymentResult.paymentUrl ?? null,
      payload: paymentResult.payload ?? null,
      response: paymentResult.response ?? null,
    });
    if (!persistResult.ok) {
      console.error('Failed to persist payment init snapshot', {
        orderId,
        code: persistResult.code,
      });
    }

    return {
      ok: paymentResult.ok && Boolean(paymentResult.paymentUrl),
      paymentUrl: paymentResult.paymentUrl ?? null,
      status,
      httpStatus: paymentResult.ok ? 200 : mapPaymentErrorToStatus(paymentResult.code),
    };
  } catch (error) {
    console.error('OZON Bank payment init failed:', error);
    await persistPaymentSnapshot(orderId, {
      provider: OZON_PAYMENT_PROVIDER,
      status: 'error',
      payable_amount: payableAmount,
    });
    return { ok: false, paymentUrl: null, status: 'error', httpStatus: 502 };
  }
}

async function initiateAlfaPayment(orderId, payableAmount, orderPayload, user) {
  try {
    const paymentResult = await alfaBankAdapter.registerPayment({
      orderId,
      orderNumber: String(orderId),
      amount: payableAmount,
      currency: alfaBankConfig.currency || '643',
      description: `Order ${orderId}`,
      clientId: user?.id != null ? String(user.id) : undefined,
      order: orderPayload,
    });

    const status = resolveNextPaymentStatus(
      'pending',
      paymentResult.status ?? (paymentResult.ok ? 'pending' : 'error'),
    );

    const responsePayload =
      paymentResult.gatewayOrderId != null
        ? { ...paymentResult.response, gatewayOrderId: paymentResult.gatewayOrderId }
        : paymentResult.response ?? null;

    const persistResult = await persistPaymentSnapshot(orderId, {
      provider: ALFA_PAYMENT_PROVIDER,
      status,
      payable_amount: payableAmount,
      payment_url: paymentResult.paymentUrl ?? null,
      payload: paymentResult.payload ?? null,
      response: responsePayload ?? null,
    });
    if (!persistResult.ok) {
      console.error('Failed to persist payment init snapshot', {
        orderId,
        code: persistResult.code,
      });
    }

    return {
      ok: paymentResult.ok && Boolean(paymentResult.paymentUrl),
      paymentUrl: paymentResult.paymentUrl ?? null,
      status,
      httpStatus: paymentResult.ok ? 200 : mapPaymentErrorToStatus(paymentResult.code),
    };
  } catch (error) {
    console.error('Alfa Bank payment init failed:', error);
    await persistPaymentSnapshot(orderId, {
      provider: ALFA_PAYMENT_PROVIDER,
      status: 'error',
      payable_amount: payableAmount,
    });
    return { ok: false, paymentUrl: null, status: 'error', httpStatus: 502 };
  }
}

async function handleOzonWebhook(req, res) {
  try {
    const rawBody = typeof req.rawBody === 'string' ? req.rawBody : '';
    const payload = await readJsonBody(req);
    const sigHeader = ozonBankConfig.webhookSignatureHeader?.toLowerCase?.();
    const providedSignature =
      (sigHeader && req.headers?.[sigHeader]) ||
      req.headers?.[ozonBankConfig.webhookSignatureHeader] ||
      req.headers?.['x-signature'] ||
      null;

    const isValid = ozonBankAdapter.verifyWebhookSignature(rawBody, providedSignature);
    if (!isValid) {
      sendJson(res, 400, { message: 'Неверная подпись webhook.' });
      return;
    }

    const orderId = ozonBankAdapter.extractWebhookOrderId(payload);
    if (!orderId) {
      sendJson(res, 202, { ok: true });
      return;
    }

    const webhookStatus =
      ozonBankAdapter.extractWebhookStatus(payload) ?? 'webhook_received';

    const persistResult = await persistPaymentSnapshot(orderId, {
      provider: OZON_PAYMENT_PROVIDER,
      status: webhookStatus,
      webhook: buildWebhookRecord(req, rawBody, payload),
    });

    if (!persistResult.ok) {
      const statusCode =
        persistResult.code === 'order_not_found'
          ? 404
          : persistResult.code === 'invalid_order_id'
            ? 202
            : 400;
      sendJson(res, statusCode, { message: 'Не удалось обработать webhook.' });
      return;
    }

    sendJson(res, 200, { ok: true });
  } catch (error) {
    console.error('Webhook handling failed:', error);
    sendJson(res, 500, { message: 'Ошибка обработки webhook.' });
  }
}

async function handleAlfaCallback(req, res) {
  try {
    const rawBody = typeof req.rawBody === 'string' ? req.rawBody : '';
    const params = extractCallbackParams(req, rawBody);
    const checksum = params.checksum ?? params.CHECKSUM ?? null;

    if (alfaBankConfig.callbackSecret) {
      if (!checksum) {
        sendJson(res, 400, { message: 'Отсутствует подпись callback.' });
        return;
      }
      const isValid = verifyAlfaChecksum(params, alfaBankConfig.callbackSecret, checksum);
      if (!isValid) {
        sendJson(res, 400, { message: 'Неверная подпись callback.' });
        return;
      }
    }

    const orderNumber = params.orderNumber ?? params.order_number ?? params.orderId ?? params.order_id ?? null;
    const orderId = orderNumber ? String(orderNumber) : null;
    const callbackMdOrderRaw = params.mdOrder ?? params.mdorder ?? null;
    const callbackMdOrder = callbackMdOrderRaw != null ? String(callbackMdOrderRaw).trim() : '';

    if (!orderId) {
      sendJson(res, 202, { ok: true });
      return;
    }

    const expectedGatewayOrderId = await getExpectedGatewayOrderId(orderId);
    if (expectedGatewayOrderId) {
      if (!callbackMdOrder) {
        sendJson(res, 400, { message: 'Отсутствует mdOrder в callback.' });
        return;
      }
      if (callbackMdOrder !== expectedGatewayOrderId) {
        sendJson(res, 400, { message: 'mdOrder не соответствует заказу.' });
        return;
      }
    }

    const webhookStatus = resolveAlfaCallbackStatus(params);

    const sideEffectResult = await applyPaymentOutcomeEffects(orderId, webhookStatus);
    if (!sideEffectResult.ok) {
      const statusCode =
        sideEffectResult.code === 'order_not_found'
          ? 404
          : sideEffectResult.code === 'invalid_order_id'
            ? 202
            : 400;
      sendJson(res, statusCode, { message: 'Не удалось обработать callback.' });
      return;
    }

    const persistResult = await persistPaymentSnapshot(orderId, {
      provider: ALFA_PAYMENT_PROVIDER,
      status: webhookStatus,
      webhook: buildWebhookRecord(req, rawBody, params),
    });

    if (!persistResult.ok) {
      const statusCode =
        persistResult.code === 'order_not_found'
          ? 404
          : persistResult.code === 'invalid_order_id'
            ? 202
            : 400;
      sendJson(res, statusCode, { message: 'Не удалось обработать callback.' });
      return;
    }

    if (sideEffectResult.transitionedToPaid) {
      const dispatchResult = await tryCreateProviderShipmentForPaidOrder(orderId);
      if (!dispatchResult.ok && dispatchResult.code !== 'already_dispatched') {
        console.error('Failed to create provider shipment after payment callback', {
          orderId,
          code: dispatchResult.code,
          message: dispatchResult.message,
        });
      }
    }

    sendJson(res, 200, { ok: true });
  } catch (error) {
    console.error('Alfa callback handling failed:', error);
    sendJson(res, 500, { message: 'Ошибка обработки callback.' });
  }
}

async function getExpectedGatewayOrderId(orderId) {
  const numericId = Number(orderId);
  if (!Number.isFinite(numericId)) return null;

  const result = await pool.query(
    `
      SELECT payment_response, order_data
      FROM order_history
      WHERE id = $1
      LIMIT 1
    `,
    [numericId],
  );

  if (result.rowCount === 0) return null;
  const row = result.rows[0] ?? {};
  const response = row.payment_response && typeof row.payment_response === 'object'
    ? row.payment_response
    : {};
  const orderData = row.order_data && typeof row.order_data === 'object'
    ? row.order_data
    : {};
  const paymentBlock =
    orderData.payment && typeof orderData.payment === 'object'
      ? orderData.payment
      : {};
  const nestedResponse =
    paymentBlock.response && typeof paymentBlock.response === 'object'
      ? paymentBlock.response
      : {};

  const candidate =
    response.gatewayOrderId ??
    response.orderId ??
    nestedResponse.gatewayOrderId ??
    nestedResponse.orderId ??
    null;

  if (!candidate) return null;
  return String(candidate).trim() || null;
}

async function persistPaymentSnapshot(orderId, patch = {}) {
  const numericId = Number(orderId);
  if (!Number.isFinite(numericId)) {
    return { ok: false, code: 'invalid_order_id' };
  }

  const existingResult = await pool.query(
    `
      SELECT
        order_data,
        payment_provider,
        payment_status,
        payment_payload,
        payment_response,
        payment_webhook,
        payable_amount
      FROM order_history
      WHERE id = $1
    `,
    [numericId],
  );

  if (existingResult.rowCount === 0) {
    return { ok: false, code: 'order_not_found' };
  }

  const existing = extractPaymentFromRow(existingResult.rows[0]);
  const merged = sanitizePaymentSnapshot(
    { ...patch, payable_amount: patch.payable_amount ?? patch.payableAmount },
    existing,
  );

  await pool.query(
    `
      UPDATE order_history
      SET payment_provider = $2,
          payment_status = $3,
          payment_payload = $4::jsonb,
          payment_response = $5::jsonb,
          payment_webhook = $6::jsonb,
          order_data = jsonb_set(
            COALESCE(order_data, '{}'::jsonb),
            '{payment}',
            $7::jsonb,
            true
          )
      WHERE id = $1
    `,
    [
      numericId,
      merged.provider,
      merged.status,
      merged.payload != null ? JSON.stringify(merged.payload) : null,
      merged.response != null ? JSON.stringify(merged.response) : null,
      merged.webhook != null ? JSON.stringify(merged.webhook) : null,
      JSON.stringify(buildOrderDataPaymentObject(merged)),
    ],
  );

  return { ok: true, snapshot: merged };
}

function buildOrderDataPaymentObject(payment) {
  return {
    provider: payment.provider ?? null,
    status: payment.status ?? null,
    payable_amount: payment.payable_amount ?? null,
    payment_url: payment.payment_url ?? null,
    payload: payment.payload ?? null,
    response: payment.response ?? null,
    webhook: payment.webhook ?? null,
  };
}

function sanitizePaymentSnapshot(patch = {}, existing = {}) {
  const provider = patch.provider ?? existing.provider ?? null;
  const status = resolveNextPaymentStatus(existing.status, patch.status ?? null);
  const payableAmount = safeNumber(patch.payable_amount ?? existing.payable_amount);
  const paymentUrl = patch.payment_url ?? existing.payment_url ?? null;
  const payload = patch.payload ?? existing.payload ?? null;
  const response = patch.response ?? existing.response ?? null;
  const webhook = patch.webhook ?? existing.webhook ?? null;

  return {
    provider,
    status,
    payable_amount: payableAmount,
    payment_url: paymentUrl,
    payload,
    response,
    webhook,
  };
}

function extractPaymentFromRow(row) {
  const paymentBlock =
    row?.order_data && typeof row.order_data === 'object'
      ? row.order_data.payment ?? {}
      : {};

  return {
    provider: row?.payment_provider ?? paymentBlock.provider ?? null,
    status: row?.payment_status ?? paymentBlock.status ?? null,
    payload: row?.payment_payload ?? paymentBlock.payload ?? null,
    response: row?.payment_response ?? paymentBlock.response ?? null,
    webhook: row?.payment_webhook ?? paymentBlock.webhook ?? null,
    payment_url: paymentBlock.payment_url ?? null,
    payable_amount: safeNumber(paymentBlock.payable_amount ?? row?.payable_amount),
  };
}

function resolveNextPaymentStatus(current, incoming) {
  const currentStatus = normalizePaymentStatus(current, null);
  const nextStatus = normalizePaymentStatus(incoming, null);
  if (!nextStatus) return currentStatus ?? null;
  if (!currentStatus) return nextStatus;

  const finalStatuses = new Set([
    'paid',
    'succeeded',
    'failed',
    'canceled',
    'cancelled',
    'success',
    'completed',
    'complete',
  ]);
  if (finalStatuses.has(currentStatus) && !finalStatuses.has(nextStatus)) {
    return currentStatus;
  }
  if (finalStatuses.has(currentStatus) && finalStatuses.has(nextStatus) && currentStatus !== nextStatus) {
    return currentStatus;
  }
  return nextStatus;
}

function normalizePaymentStatus(status, fallback = null) {
  if (typeof status !== 'string') return fallback;
  const normalized = status.trim().toLowerCase().replace(/\s+/g, '_');
  return normalized || fallback;
}

function mapPaymentErrorToStatus(code) {
  if (code === 'api_base_missing') return 503;
  if (code === 'http_error' || code === 'network_error') return 502;
  return 500;
}

async function applyPaymentOutcomeEffects(orderId, incomingPaymentStatus) {
  const numericId = Number(orderId);
  if (!Number.isFinite(numericId)) {
    return { ok: false, code: 'invalid_order_id' };
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const orderResult = await client.query(
      `
        SELECT id, user_id, bonus_spent, bonus_earned, order_data, payment_status
        FROM order_history
        WHERE id = $1
        FOR UPDATE
      `,
      [numericId],
    );

    if (orderResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return { ok: false, code: 'order_not_found' };
    }

    const row = orderResult.rows[0];
    const currentPaymentStatus = normalizePaymentStatus(row.payment_status, 'pending');
    const nextPaymentStatus = normalizePaymentStatus(incomingPaymentStatus, currentPaymentStatus);
    const wasPaid = isPaymentSuccessStatus(currentPaymentStatus);
    const isPaid = isPaymentSuccessStatus(nextPaymentStatus);
    const isFailed = isPaymentFailureStatus(nextPaymentStatus);
    const transitionedToPaid = isPaid && !wasPaid;

    const orderData =
      row.order_data && typeof row.order_data === 'object'
        ? JSON.parse(JSON.stringify(row.order_data))
        : {};
    const bonusData =
      orderData.bonus && typeof orderData.bonus === 'object'
        ? { ...orderData.bonus }
        : {};
    const bonusSpent = Math.max(0, Math.floor(Number(row.bonus_spent) || 0));
    const bonusEarned = Math.max(0, Math.floor(Number(row.bonus_earned) || 0));
    const now = new Date().toISOString();

    let bonusDelta = 0;

    if (transitionedToPaid && bonusEarned > 0 && !bonusData.earnedAppliedAt) {
      bonusDelta += bonusEarned;
      bonusData.earnedAppliedAt = now;
    }

    if (isPaid && bonusSpent > 0 && bonusData.spentReserved === true) {
      bonusData.spentReserved = false;
      bonusData.spentAppliedAt = bonusData.spentAppliedAt ?? now;
    }

    if (
      isFailed &&
      bonusSpent > 0 &&
      bonusData.spentRestoredAt == null &&
      (bonusData.spentReserved === true || bonusData.spentReserved == null)
    ) {
      bonusDelta += bonusSpent;
      bonusData.spentReserved = false;
      bonusData.spentRestoredAt = now;
    }

    if (bonusDelta !== 0) {
      await client.query(
        `
          UPDATE users
          SET bonus_balance = GREATEST(0, COALESCE(bonus_balance, 0) + $1),
              updated_at = NOW()
          WHERE id = $2
        `,
        [bonusDelta, row.user_id],
      );
    }

    orderData.bonus = bonusData;
    orderData.status = resolveOrderStatusByPayment(nextPaymentStatus, orderData.status);
    if (isPaid && !orderData.delivery_status) {
      orderData.delivery_status = 'paid';
    }
    if (isFailed && orderData.delivery_status !== 'dispatched') {
      orderData.delivery_status = 'cancelled';
    }

    await client.query(
      `
        UPDATE order_history
        SET order_data = $2::jsonb
        WHERE id = $1
      `,
      [numericId, JSON.stringify(orderData)],
    );

    await client.query('COMMIT');
    return { ok: true, transitionedToPaid };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Failed to apply payment outcome effects:', error);
    return { ok: false, code: 'db_error' };
  } finally {
    client.release();
  }
}

function safeNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

async function tryCreateProviderShipmentForPaidOrder(orderId) {
  const numericId = Number(orderId);
  if (!Number.isFinite(numericId)) {
    return { ok: false, code: 'invalid_order_id' };
  }

  const orderResult = await pool.query(
    `
      SELECT id, order_data, payment_status
      FROM order_history
      WHERE id = $1
    `,
    [numericId],
  );

  if (orderResult.rowCount === 0) {
    return { ok: false, code: 'order_not_found' };
  }

  const row = orderResult.rows[0];
  const orderData =
    row.order_data && typeof row.order_data === 'object'
      ? JSON.parse(JSON.stringify(row.order_data))
      : {};
  const paymentStatus = normalizePaymentStatus(
    row.payment_status,
    orderData?.payment?.status ?? 'pending',
  );
  if (!isPaymentSuccessStatus(paymentStatus)) {
    return { ok: false, code: 'payment_not_success' };
  }

  const deliveryData =
    orderData.delivery && typeof orderData.delivery === 'object'
      ? { ...orderData.delivery }
      : null;
  if (!deliveryData?.provider || !deliveryData?.type) {
    return { ok: false, code: 'delivery_data_missing' };
  }

  const currentDispatch =
    deliveryData.dispatch && typeof deliveryData.dispatch === 'object'
      ? { ...deliveryData.dispatch }
      : null;
  if (deliveryData.delivery_status === 'dispatched' || currentDispatch?.status === 'created') {
    return { ok: true, code: 'already_dispatched' };
  }
  if (orderData.delivery_status === 'dispatched') {
    return { ok: true, code: 'already_dispatched' };
  }

  const requestPayload = {
    provider: deliveryData.provider,
    type: deliveryData.type,
    order_id: numericId,
    order_number: orderData.number ? String(orderData.number) : `AS-${numericId}`,
    total_weight:
      safeNumber(orderData.total_weight) ??
      safeNumber(deliveryData.total_weight) ??
      extractTotalWeight(orderData) ??
      1,
    pickup_point_id: deliveryData.pickup_point_id ?? null,
    address: deliveryData.address ?? null,
    recipient: deliveryData.recipient ?? null,
    tariff_code:
      deliveryData.tariff_code ??
      deliveryData.tariffCode ??
      deliveryData.provider_metadata?.tariff_code ??
      null,
    provider_metadata: deliveryData.provider_metadata ?? null,
    items: Array.isArray(orderData.items) ? orderData.items : [],
    comment: deliveryData.comment ?? null,
  };

  try {
    const shipment = await createDeliveryShipment(requestPayload);
    const now = new Date().toISOString();

    orderData.delivery = {
      ...deliveryData,
      dispatch: {
        ...(currentDispatch ?? {}),
        status: 'created',
        requested_at: now,
        provider_order_id: shipment?.provider_order_id ?? null,
        track_number: shipment?.track_number ?? null,
        payload: shipment?.payload ?? requestPayload,
        response: shipment?.response ?? null,
      },
      delivery_status: 'dispatched',
    };
    orderData.delivery_status = 'dispatched';

    await pool.query(
      `
        UPDATE order_history
        SET order_data = $2::jsonb
        WHERE id = $1
      `,
      [numericId, JSON.stringify(orderData)],
    );

    return {
      ok: true,
      code: 'dispatched',
      providerOrderId: shipment?.provider_order_id ?? null,
      trackNumber: shipment?.track_number ?? null,
    };
  } catch (error) {
    const now = new Date().toISOString();
    const message = error instanceof Error ? error.message : String(error);

    orderData.delivery = {
      ...deliveryData,
      dispatch: {
        ...(currentDispatch ?? {}),
        status: 'error',
        requested_at: now,
        error: message,
      },
      delivery_status: 'dispatch_error',
    };
    orderData.delivery_status = 'dispatch_error';

    await pool.query(
      `
        UPDATE order_history
        SET order_data = $2::jsonb
        WHERE id = $1
      `,
      [numericId, JSON.stringify(orderData)],
    );

    return { ok: false, code: 'dispatch_error', message };
  }
}

function extractCallbackParams(req, rawBody) {
  const queryParams =
    req && req.query && typeof req.query === 'object'
      ? { ...req.query }
      : {};

  if (req && req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return { ...queryParams, ...req.body };
  }

  const raw = typeof rawBody === 'string' ? rawBody.trim() : '';
  if (!raw) return queryParams;

  try {
    const params = new URLSearchParams(raw);
    return { ...queryParams, ...Object.fromEntries(params.entries()) };
  } catch {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return { ...queryParams, ...parsed };
      }
    } catch {
      // ignore parse errors
    }
    return queryParams;
  }
}

function verifyAlfaChecksum(params, secret, checksum) {
  if (!secret || !checksum || !params) return false;
  const entries = Object.entries(params)
    .filter(([key]) => {
      const lowered = key.toLowerCase();
      return lowered !== 'checksum' && lowered !== 'sign_alias';
    })
    .map(([key, value]) => [key, String(value ?? '')]);

  entries.sort(([a], [b]) => a.localeCompare(b, 'en'));

  const payload = entries.map(([key, value]) => `${key};${value};`).join('');
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
    .toUpperCase();

  return expected === String(checksum).toUpperCase();
}

function resolveAlfaCallbackStatus(params = {}) {
  const operation = String(params.operation ?? '').toLowerCase();
  const rawStatus = params.status;
  const status = String(rawStatus ?? '').toLowerCase();
  const hasStatus = status.length > 0;
  const isSuccess = status === '1' || status === 'true';
  const isFailed = status === '0' || status === 'false';

  if (operation === 'deposited') return !hasStatus || isSuccess ? 'paid' : 'declined';
  if (operation === 'approved') return !hasStatus || isSuccess ? 'authorized' : 'declined';
  if (operation === 'reversed') return !hasStatus || isSuccess ? 'cancelled' : 'declined';
  if (operation === 'refunded') return !hasStatus || isSuccess ? 'refunded' : 'declined';
  if (operation === 'declinedbytimeout' || operation === 'declinedcardpresent') return 'declined';
  if (isSuccess) return 'success';
  if (isFailed) return 'declined';

  return operation || 'callback_received';
}

function isPaymentSuccessStatus(status) {
  const normalized = normalizePaymentStatus(status, '');
  return ['paid', 'success', 'succeeded', 'completed', 'complete'].includes(normalized);
}

function isPaymentFailureStatus(status) {
  const normalized = normalizePaymentStatus(status, '');
  return [
    'failed',
    'error',
    'declined',
    'cancelled',
    'canceled',
    'refunded',
    'reversed',
    'timeout',
  ].includes(normalized);
}

function resolveOrderStatusByPayment(paymentStatus, currentOrderStatus) {
  if (isPaymentSuccessStatus(paymentStatus)) {
    return 'paid';
  }

  if (isPaymentFailureStatus(paymentStatus)) {
    return 'cancelled';
  }

  const normalizedCurrent = normalizeOrderLifecycleStatus(currentOrderStatus);
  return normalizedCurrent ?? 'processing';
}

function normalizeOrderLifecycleStatus(status) {
  const normalized = normalizePaymentStatus(status, null);
  if (!normalized) return null;
  if (['processing', 'delivered', 'cancelled', 'paid'].includes(normalized)) {
    return normalized;
  }
  return null;
}

function buildWebhookRecord(req, rawBody, parsedBody) {
  return {
    received_at: new Date().toISOString(),
    signature:
      req.headers?.[ozonBankConfig.webhookSignatureHeader] ??
      req.headers?.[ozonBankConfig.webhookSignatureHeader?.toLowerCase?.()] ??
      req.headers?.['x-signature'] ??
      null,
    headers: pickWebhookHeaders(req.headers),
    raw_body: rawBody ?? null,
    parsed_body: parsedBody ?? null,
  };
}

function pickWebhookHeaders(headers = {}) {
  const allowedKeys = [
    'x-signature',
    'x-merchant-id',
    ozonBankConfig.webhookSignatureHeader?.toLowerCase?.(),
  ].filter(Boolean);
  const result = {};
  for (const [key, value] of Object.entries(headers)) {
    if (allowedKeys.includes(key.toLowerCase())) {
      result[key] = value;
    }
  }
  return result;
}
