import nodemailer, { Transporter } from 'nodemailer';

let transporter: Transporter | null = null;

const getTransporter = (): Transporter => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD,
      },
    });
  }
  return transporter;
};

/**
 * Envía un correo. Si EMAIL_USER/EMAIL_APP_PASSWORD no están configurados en .env,
 * no falla la request — solo lo deja registrado en consola (útil en desarrollo).
 */
export const sendEmail = async (to: string, subject: string, html: string): Promise<void> => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
    console.warn(
      `[email] EMAIL_USER/EMAIL_APP_PASSWORD no configurados en .env — no se envió el correo a ${to} ("${subject}")`
    );
    return;
  }

  await getTransporter().sendMail({
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to,
    subject,
    html,
  });
};
