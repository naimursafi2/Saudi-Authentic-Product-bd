import { env, isSmsConfigured } from "./env";

export { isSmsConfigured };

/**
 * Placeholder SMS gateway integration. No SMS provider has been chosen or
 * provisioned for this project yet (see CLAUDE.md's "No SMS gateway"
 * limitation) — this exists so a real provider (Twilio, SSL Wireless, a
 * Bangladeshi bulk-SMS API, etc.) can be plugged in later purely by pointing
 * `SMS_API_URL`/`SMS_API_KEY`/`SMS_SENDER_ID` at it, without touching any of
 * this function's call sites. Until then it safely no-ops and logs, the same
 * graceful-degrade pattern as `isCloudinaryConfigured`/`isSmtpConfigured`/
 * `isGoogleConfigured`. Never throws — SMS delivery is best-effort and must
 * not fail the caller's request.
 *
 * Returns whether the send actually went out (`false` when not configured,
 * or when the request itself failed) — added for the Campaign system's
 * per-channel delivery stats (`campaignDispatch.service.ts`), which needs to
 * know success/failure per recipient. The original fire-and-forget callers
 * (`void sendSms(...)`) are unaffected: they already ignore the return value.
 */
export async function sendSms(to: string, message: string): Promise<boolean> {
  if (!isSmsConfigured) {
    console.warn(`[sms] SMS gateway not configured — would send to ${to}: ${message}`);
    return false;
  }

  try {
    // Generic REST shape most bulk-SMS gateways accept — verify against the
    // actual chosen provider's docs before relying on this in production.
    await fetch(env.SMS_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.SMS_API_KEY}`,
      },
      body: JSON.stringify({ to, from: env.SMS_SENDER_ID, message }),
    });
    return true;
  } catch (err) {
    console.error(`[sms] failed to send to ${to}:`, (err as Error).message);
    return false;
  }
}
