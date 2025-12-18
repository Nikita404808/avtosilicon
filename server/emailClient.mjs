import { isMailerSendConfigured, sendMail as sendViaMailerSend } from './mailersendClient.mjs';
import { isSmtpConfigured, sendMail as sendViaSmtp, verifySmtpConnection } from './smtpClient.mjs';

const frontendBaseUrl =
  process.env.FRONTEND_BASE_URL?.replace(/\/$/, '') ||
  (process.env.NODE_ENV === 'production' ? 'https://автосиликон.рф' : `http://localhost:${5173}`);

function pickProvider() {
  if (isSmtpConfigured()) return 'smtp';
  if (isMailerSendConfigured()) return 'mailersend';
  return null;
}

function logProvider(provider) {
  console.log(`[Email] Using provider: ${provider}`);
}

function buildVerificationMessage(toEmail, code) {
  const subject = 'Подтверждение регистрации в Автосиликон';
  const text = `Ваш код подтверждения: ${code}`;
  const html = `
      <p>Привет!</p>
      <p>Ваш код подтверждения на сайте Автосиликон: <b>${code}</b></p>
      <p>Если вы не регистрировались на нашем сайте, просто игнорируйте это письмо.</p>
    `;
  return { to: toEmail, subject, text, html };
}

function buildResetMessage(toEmail, token) {
  const resetLink = `${frontendBaseUrl}/reset-password?token=${encodeURIComponent(token)}`;
  const subject = 'Сброс пароля на Автосиликон';
  const text = `Для сброса пароля перейдите по ссылке: ${resetLink}`;
  const html = `
      <p>Привет!</p>
      <p>Вы запросили сброс пароля на сайте Автосиликон.</p>
      <p>Для сброса пароля перейдите по ссылке:</p>
      <p><a href="${resetLink}">${resetLink}</a></p>
      <p>Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо.</p>
    `;
  return { to: toEmail, subject, text, html };
}

async function sendWithProvider(provider, message) {
  if (provider === 'smtp') {
    await sendViaSmtp(message);
    return;
  }
  if (provider === 'mailersend') {
    await sendViaMailerSend(message);
    return;
  }
  throw new Error('No email provider configured');
}

export async function sendVerificationEmail(toEmail, code) {
  const provider = pickProvider();
  if (!provider) {
    console.error('[Email] No email provider configured for verification email');
    throw new Error('No email provider configured');
  }
  logProvider(provider);
  const message = buildVerificationMessage(toEmail, code);
  await sendWithProvider(provider, message);
}

export async function sendPasswordResetEmail(toEmail, token) {
  const provider = pickProvider();
  if (!provider) {
    console.error('[Email] No email provider configured for password reset email');
    throw new Error('No email provider configured');
  }
  logProvider(provider);
  const message = buildResetMessage(toEmail, token);
  await sendWithProvider(provider, message);
}

export async function verifyEmailProvider() {
  if (isSmtpConfigured()) {
    await verifySmtpConnection();
    console.log('[Email] SMTP connection verified');
    return 'smtp';
  }
  if (isMailerSendConfigured()) {
    console.log('[Email] MailerSend configured (verification skipped)');
    return 'mailersend';
  }
  throw new Error('No email provider configured');
}
