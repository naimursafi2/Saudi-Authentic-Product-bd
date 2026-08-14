import nodemailer, { type Transporter } from "nodemailer";
import { env, isSmtpConfigured } from "./env";

let transporter: Transporter | null = null;

/**
 * Lazily creates a single shared transporter. Mirrors cloudinary.ts's
 * configured-or-noop pattern — callers check `isSmtpConfigured` (or catch
 * the rejection from `sendMail`) rather than crash the server at boot when
 * SMTP credentials are absent.
 */
function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: env.SMTP_SERVICE,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    });
  }
  return transporter;
}

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
}

/**
 * Sends an email via the configured SMTP account. Rejects with a plain
 * Error (not ApiError) when SMTP isn't configured — callers in request
 * handlers should treat email delivery as best-effort and never let it
 * fail the parent request.
 */
export async function sendMail(options: SendMailOptions): Promise<void> {
  if (!isSmtpConfigured) {
    throw new Error(
      "Email delivery is not available — SMTP_SERVICE, SMTP_USER and SMTP_PASS have not been configured on the server."
    );
  }

  await getTransporter().sendMail({
    from: env.SMTP_FROM || env.SMTP_USER,
    to: options.to,
    subject: options.subject,
    html: options.html,
  });
}
