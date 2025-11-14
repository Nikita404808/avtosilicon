import 'dotenv/config';
import http from 'node:http';
import crypto from 'node:crypto';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import { sendVerificationEmail, sendPasswordResetEmail } from './mailersendClient.js';

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
const ALLOWED_ORIGIN = process.env.CORS_ORIGIN || 'http://31.31.207.27:5173';
const emailVerifyTtlMin = Number(process.env.EMAIL_VERIFY_TTL_MIN ?? 15);
const passwordResetTtlMin = Number(process.env.PASSWORD_RESET_TTL_MIN ?? 30);
const emailVerifyTtlMs = minutesToMs(emailVerifyTtlMin);
const passwordResetTtlMs = minutesToMs(passwordResetTtlMin);
const throttleWindowMs = 60 * 1000;

const sessions = new Map();
const verifyThrottleMap = new Map();
const resetThrottleMap = new Map();
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

const server = http.createServer(async (req, res) => {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  const requestUrl = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

  if (req.method === 'GET' && requestUrl.pathname.startsWith('/health')) {
    try {
      await pool.query('SELECT 1');
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ ok: true }));
    } catch (error) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ ok: false, error: 'db_unreachable' }));
    }
    return;
  }

  if (req.method === 'POST' && requestUrl.pathname === '/api/auth/register') {
    await handleRegister(req, res);
    return;
  }

  if (req.method === 'POST' && requestUrl.pathname === '/api/auth/login') {
    await handleLogin(req, res);
    return;
  }

  if (req.method === 'GET' && requestUrl.pathname === '/api/auth/me') {
    await handleCurrentUser(req, res);
    return;
  }

  if (req.method === 'POST' && requestUrl.pathname === '/api/auth/send-verify-code') {
    await handleSendVerifyCode(req, res);
    return;
  }

  if (req.method === 'POST' && requestUrl.pathname === '/api/auth/verify-email') {
    await handleVerifyEmail(req, res);
    return;
  }

  if (req.method === 'POST' && requestUrl.pathname === '/api/auth/request-password-reset') {
    await handleRequestPasswordReset(req, res);
    return;
  }

  if (req.method === 'POST' && requestUrl.pathname === '/api/auth/reset-password') {
    await handleResetPassword(req, res);
    return;
  }

  if (req.method === 'PUT' && requestUrl.pathname === '/api/users/me/name') {
    await handleUpdateName(req, res);
    return;
  }

  if (req.method === 'POST' && requestUrl.pathname === '/api/orders') {
    await handleCreateOrder(req, res);
    return;
  }

  if (req.method === 'GET' && requestUrl.pathname === '/api/orders') {
    await handleGetOrders(req, res);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ message: 'Not found' }));
});

server.listen(PORT, '0.0.0.0', () => {
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
        RETURNING id, email, name, email_verified
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
      'SELECT id, email, password_hash, name, email_verified FROM users WHERE email = $1',
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

    const verifyToken = crypto.randomBytes(32).toString('hex');
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

    if (!order || typeof order !== 'object' || Array.isArray(order) || !Object.keys(order).length) {
      sendJson(res, 400, { message: 'Некорректные данные заказа.' });
      return;
    }

    await pool.query('INSERT INTO order_history (user_id, order_data) VALUES ($1, $2::jsonb)', [
      authUser.id,
      JSON.stringify(order),
    ]);

    sendJson(res, 200, { success: true });
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
        SELECT id, order_data, created_at
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

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Vary', 'Origin');
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  );
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
    : 'id, email, name, email_verified';
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
  return error instanceof Error && /Невалидный JSON/.test(error.message);
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
