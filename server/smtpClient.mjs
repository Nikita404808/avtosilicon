import nodemailer from 'nodemailer';

const smtpHost = process.env.SMTP_HOST;
const smtpPort = Number(process.env.SMTP_PORT) || 465;
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const smtpFrom = process.env.SMTP_FROM;

let transport;

export function isSmtpConfigured() {
  return Boolean(smtpHost && smtpPort && smtpUser && smtpPass && smtpFrom);
}

function getTransport() {
  if (!isSmtpConfigured()) {
    throw new Error('SMTP is not configured');
  }
  if (!transport) {
    const secure = smtpPort === 465;
    transport = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });
  }
  return transport;
}

export async function verifySmtpConnection() {
  if (!isSmtpConfigured()) {
    throw new Error('SMTP is not configured');
  }
  const client = getTransport();
  await client.verify();
}

export async function sendMail({ to, subject, text, html }) {
  const client = getTransport();
  await client.sendMail({
    from: smtpFrom,
    to,
    subject,
    text,
    html,
  });
}
