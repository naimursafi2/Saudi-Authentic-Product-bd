import { config as loadDotenv } from "dotenv";
import path from "path";
import { z } from "zod";

loadDotenv({ path: path.resolve(process.cwd(), ".env") });

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().default(5000),
  API_PREFIX: z.string().default("/api/v1"),

  CLIENT_ORIGIN: z.string().default("http://localhost:3000"),

  MONGODB_URI: z
    .string()
    .default("mongodb://127.0.0.1:27017/saudi_authentic_product"),

  JWT_ACCESS_SECRET: z.string().min(1, "JWT_ACCESS_SECRET is required"),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_SECRET: z.string().min(1, "JWT_REFRESH_SECRET is required"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("15d"),
  COOKIE_DOMAIN: z.string().optional(),

  CLOUDINARY_CLOUD_NAME: z.string().optional().default(""),
  CLOUDINARY_API_KEY: z.string().optional().default(""),
  CLOUDINARY_API_SECRET: z.string().optional().default(""),

  SMTP_SERVICE: z.string().optional().default(""),
  SMTP_USER: z.string().optional().default(""),
  SMTP_PASS: z.string().optional().default(""),
  SMTP_FROM: z.string().optional().default(""),

  GOOGLE_CLIENT_ID: z.string().optional().default(""),

  // No specific SMS provider is chosen yet — these are generic enough to fit
  // most REST SMS gateways (Twilio, SSL Wireless, etc.). See config/sms.ts.
  SMS_API_URL: z.string().optional().default(""),
  SMS_API_KEY: z.string().optional().default(""),
  SMS_SENDER_ID: z.string().optional().default(""),

  // bKash Tokenized Checkout API. Leave blank until real credentials are
  // provisioned — bKash payment creation/verification returns a clear 503
  // until these are set (see config/bkash.ts), same graceful-degrade
  // pattern as Cloudinary/SMTP/SMS above. Dummy defaults only.
  BKASH_BASE_URL: z.string().optional().default(""),
  BKASH_USERNAME: z.string().optional().default(""),
  BKASH_PASSWORD: z.string().optional().default(""),
  BKASH_APP_KEY: z.string().optional().default(""),
  BKASH_APP_SECRET: z.string().optional().default(""),

  // Shared secret with the Next.js frontend's `/api/revalidate` route — see
  // utils/revalidateFrontend.ts. Left blank means "not configured yet",
  // same graceful-degrade pattern as Cloudinary/SMTP/SMS/bKash above: the
  // admin portal keeps working exactly as before, it just falls back to the
  // frontend's own long safety-net cache window instead of an instant push.
  REVALIDATE_SECRET: z.string().optional().default(""),

  SEED_SUPER_ADMIN_NAME: z.string().default("Super Admin"),
  SEED_SUPER_ADMIN_EMAIL: z
    .string()
    .email()
    .default("superadmin@saudiauthenticproduct.com"),
  SEED_SUPER_ADMIN_PASSWORD: z.string().min(8).default("ChangeMe123!"),
});

// In test environment we don't want to hard-fail if secrets are missing —
// provide safe defaults so `jest` can run without a `.env` file.
const parsed = envSchema.safeParse({
  ...process.env,
  JWT_ACCESS_SECRET:
    process.env.JWT_ACCESS_SECRET ??
    (process.env.NODE_ENV === "test" ? "test-access-secret" : undefined),
  JWT_REFRESH_SECRET:
    process.env.JWT_REFRESH_SECRET ??
    (process.env.NODE_ENV === "test" ? "test-refresh-secret" : undefined),
});

if (!parsed.success) {
  console.error(
    "Invalid environment variables:",
    parsed.error.flatten().fieldErrors,
  );
  throw new Error(
    "Invalid environment variables. Check your .env file against .env.example.",
  );
}

export const env = parsed.data;

export const isProduction = env.NODE_ENV === "production";
export const isCloudinaryConfigured = Boolean(
  env.CLOUDINARY_CLOUD_NAME &&
  env.CLOUDINARY_API_KEY &&
  env.CLOUDINARY_API_SECRET,
);

export const isSmtpConfigured = Boolean(
  env.SMTP_SERVICE && env.SMTP_USER && env.SMTP_PASS,
);

export const isGoogleConfigured = Boolean(env.GOOGLE_CLIENT_ID);

export const isSmsConfigured = Boolean(env.SMS_API_URL && env.SMS_API_KEY && env.SMS_SENDER_ID);

export const isRevalidateConfigured = Boolean(env.REVALIDATE_SECRET);

/** Every variable bKash needs. All five must be set for the gateway to work. */
export const BKASH_ENV_KEYS = [
  "BKASH_BASE_URL",
  "BKASH_USERNAME",
  "BKASH_PASSWORD",
  "BKASH_APP_KEY",
  "BKASH_APP_SECRET",
] as const;

/**
 * Which of the five are still unset. Reported to staff (never publicly) so a
 * half-configured gateway names the missing variables instead of silently
 * behaving as if bKash simply doesn't exist — only the variable *names* are
 * ever returned, never their values.
 */
export function missingBkashEnvKeys(): string[] {
  return BKASH_ENV_KEYS.filter((key) => !env[key]);
}

export const isBkashConfigured = missingBkashEnvKeys().length === 0;

/**
 * `CLIENT_ORIGIN` may be a single origin or a comma-separated list (e.g. a
 * local dev server plus a deployed preview URL). Trimmed and empty entries
 * dropped so a trailing comma or stray whitespace doesn't produce a blank
 * "allowed origin".
 */
export const clientOrigins: string[] = env.CLIENT_ORIGIN.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
