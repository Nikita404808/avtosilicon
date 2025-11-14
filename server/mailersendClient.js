import { MailerSend, EmailParams, Sender, Recipient } from 'mailersend';

const apiKey = process.env.MAILERSEND_API_KEY;
if (!apiKey) {
  throw new Error('MAILERSEND_API_KEY is not set');
}

const fromEmail = process.env.MAILERSEND_FROM_EMAIL;
if (!fromEmail) {
  throw new Error('MAILERSEND_FROM_EMAIL is not set');
}

const fromName = process.env.MAILERSEND_FROM_NAME || 'Avtosilicon';
const mailerSend = new MailerSend({ apiKey });
const sentFrom = new Sender(fromEmail, fromName);

const frontendBaseUrl =
  process.env.FRONTEND_BASE_URL?.replace(/\/$/, '') || 'http://31.31.207.27:5173';

export async function sendVerificationEmail(toEmail, code) {
  const recipients = [new Recipient(toEmail, toEmail)];

  const emailParams = new EmailParams()
    .setFrom(sentFrom)
    .setTo(recipients)
    .setSubject('Подтверждение регистрации в Автосиликон')
    .setText(`Ваш код подтверждения: ${code}`)
    .setHtml(
      `
      <p>Привет!</p>
      <p>Ваш код подтверждения на сайте Автосиликон: <b>${code}</b></p>
      <p>Если вы не регистрировались на нашем сайте, просто игнорируйте это письмо.</p>
    `,
    );

  await mailerSend.email.send(emailParams);
}

export async function sendPasswordResetEmail(toEmail, token) {
  const recipients = [new Recipient(toEmail, toEmail)];
  const resetLink = `${frontendBaseUrl}/reset-password?token=${encodeURIComponent(token)}`;

  const emailParams = new EmailParams()
    .setFrom(sentFrom)
    .setTo(recipients)
    .setSubject('Сброс пароля на Автосиликон')
    .setText(`Для сброса пароля перейдите по ссылке: ${resetLink}`)
    .setHtml(
      `
      <p>Привет!</p>
      <p>Вы запросили сброс пароля на сайте Автосиликон.</p>
      <p>Для сброса пароля перейдите по ссылке:</p>
      <p><a href="${resetLink}">${resetLink}</a></p>
      <p>Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо.</p>
    `,
    );

  await mailerSend.email.send(emailParams);
}
