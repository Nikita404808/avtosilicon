import 'dotenv/config';
import http from 'node:http';
import crypto from 'node:crypto';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

const requiredEnv = ['DATABASE_URL'];
const missingEnv = requiredEnv.filter((key) => !process.env[key]);

if (missingEnv.length > 0) {
  console.error(`Missing required env variables: ${missingEnv.join(', ')}`);
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const port = Number(process.env.PORT) || 3000;
const allowedOrigin = process.env.CORS_ORIGIN ?? 'http://31.31.207.27:5173';
const sessions = new Map();
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

const server = http.createServer(async (req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const requestUrl = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

  if (req.method === 'GET' && requestUrl.pathname === '/health') {
    await respondHealthCheck(res);
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

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ message: 'Not found' }));
});

server.listen(port, () => {
  console.log(`Auth backend is listening on port ${port}`);
});

process.on('SIGINT', async () => {
  await pool.end();
  process.exit(0);
});

const respondHealthCheck = async (res) => {
  try {
    await pool.query('SELECT 1');
    sendJson(res, 200, { status: 'ok' });
  } catch (error) {
    console.error('Database health check failed:', error);
    sendJson(res, 500, { status: 'error', message: 'Database unreachable' });
  }
};

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
        RETURNING id, email
      `,
      [email, passwordHash],
    );

    const user = insertResult.rows[0];
    const token = createSession(user.id);

    sendJson(res, 201, { id: String(user.id), email: user.email, token });
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

    const queryResult = await pool.query('SELECT id, email, password_hash FROM users WHERE email = $1', [
      email,
    ]);

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
    sendJson(res, 200, { id: String(user.id), email: user.email, token });
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
    const token = extractToken(req.headers['authorization']);
    if (!token) {
      sendJson(res, 401, { message: 'Токен не найден.' });
      return;
    }

    const session = getSession(token);
    if (!session) {
      sendJson(res, 401, { message: 'Сессия недействительна или устарела.' });
      return;
    }

    const userResult = await pool.query('SELECT id, email FROM users WHERE id = $1', [session.userId]);
    if (userResult.rowCount === 0) {
      sessions.delete(token);
      sendJson(res, 401, { message: 'Пользователь не найден.' });
      return;
    }

    const user = userResult.rows[0];
    sendJson(res, 200, { id: String(user.id), email: user.email });
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

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
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
