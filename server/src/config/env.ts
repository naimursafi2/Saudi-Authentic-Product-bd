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
  JWT_REFRESH_EXPIRES_IN: z.string().default("30d"),
  COOKIE_DOMAIN: z.string().optional(),

  CLOUDINARY_CLOUD_NAME: z.string().optional().default(""),
  CLOUDINARY_API_KEY: z.string().optional().default(""),
  CLOUDINARY_API_SECRET: z.string().optional().default(""),

  SMTP_SERVICE: z.string().optional().default(""),
  SMTP_USER: z.string().optional().default(""),
  SMTP_PASS: z.string().optional().default(""),
  SMTP_FROM: z.string().optional().default(""),

  GOOGLE_CLIENT_ID: z.string().optional().default(""),

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

/**
 * `CLIENT_ORIGIN` may be a single origin or a comma-separated list (e.g. a
 * local dev server plus a deployed preview URL). Trimmed and empty entries
 * dropped so a trailing comma or stray whitespace doesn't produce a blank
 * "allowed origin".
 */
export const clientOrigins: string[] = env.CLIENT_ORIGIN.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
