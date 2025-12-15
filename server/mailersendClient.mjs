import { MailerSend, EmailParams, Sender, Recipient } from 'mailersend';

const apiKey = process.env.MAILERSEND_API_KEY;
const fromEmail = process.env.MAILERSEND_FROM_EMAIL;
const fromName = process.env.MAILERSEND_FROM_NAME || 'Avtosilicon';

const mailerSend = apiKey ? new MailerSend({ apiKey }) : null;
const sentFrom = fromEmail ? new Sender(fromEmail, fromName) : null;

export function isMailerSendConfigured() {
  return Boolean(mailerSend && sentFrom);
}

export async function sendMail({ to, subject, text, html }) {
  if (!isMailerSendConfigured()) {
    throw new Error('MailerSend is not configured');
  }
  const recipients = [new Recipient(to, to)];

  const emailParams = new EmailParams()
    .setFrom(sentFrom)
    .setTo(recipients)
    .setSubject(subject)
    .setText(text)
    .setHtml(html);

  await mailerSend.email.send(emailParams);
}
