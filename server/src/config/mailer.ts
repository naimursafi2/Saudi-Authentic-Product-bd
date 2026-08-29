import nodemailer, { type Transporter } from "nodemailer";
import { env, isSmtpConfigured } from "./env";

let transporter: Transporter | null = null;

/**
 * Lazily creates a single shared transporter. Mirrors cloudinary.ts's
 * configured-or-noop pattern — callers check `isSmtpConfigured` (or catch
 * the rejection from `sendMail`) rather than crash the server at boot when
 * SMTP credentials are absent.
 *
 * **Under `NODE_ENV=test` this never touches the network.** Nodemailer's
 * `jsonTransport` serialises each message in memory and resolves as if it had
 * been delivered, so tests exercise the real call path without spending the
 * shared mailbox's quota.
 *
 * That guard is not a convenience — it fixes a real outage. Only three of the
 * test suites mocked email, so a full `npm test` run fired dozens of genuine
 * messages (order confirmations, staff alerts) through the production Gmail
 * account. A few runs in a day exhausted Gmail's daily sending limit, after
 * which every real send failed with `550-5.4.5 Daily user sending limit
 * exceeded` — including the verification email a newly registered customer
 * was waiting for, silently, because `safeSend` swallows delivery failures.
 */
function getTransporter(): Transporter {
  if (!transporter) {
    transporter =
      env.NODE_ENV === "test"
        ? nodemailer.createTransport({ jsonTransport: true })
        : nodemailer.createTransport({
            service: env.SMTP_SERVICE,
            auth: {
              user: env.SMTP_USER,
              // Gmail shows an App Password as "xxxx xxxx xxxx xxxx". The
              // spaces are display formatting only; strip them so a value
              // pasted straight from Google still authenticates.
              pass: env.SMTP_PASS.replace(/\s+/g, ""),
            },
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
  // In tests the JSON transport stands in for a real mailbox, so an absent
  // SMTP config must not short-circuit the path under test.
  if (!isSmtpConfigured && env.NODE_ENV !== "test") {
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
