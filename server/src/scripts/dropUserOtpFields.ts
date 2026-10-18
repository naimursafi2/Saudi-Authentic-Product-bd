/**
 * One-off migration: registration and delivery OTPs moved from MongoDB to
 * Redis (see services/otp.store.ts). This strips the now-unused fields from
 * every existing user and order. `Order.otpVerifiedAt` is a permanent audit
 * timestamp and is intentionally kept.
 *
 *   npm run migrate:drop-user-otp-fields
 *
 * Safe to re-run — users without these fields are simply not matched.
 */
import mongoose from "mongoose";
import { connectDatabase, disconnectDatabase } from "../config/db";

const TARGETS: { collection: string; fields: string[] }[] = [
  {
    collection: "users",
    fields: ["emailVerificationOtp", "emailVerificationOtpExpires", "emailVerificationOtpAttempts"],
  },
  {
    collection: "orders",
    fields: ["otpCode", "otpGeneratedAt", "otpExpiresAt", "otpAttempts"],
  },
];

async function main() {
  await connectDatabase();

  for (const { collection, fields } of TARGETS) {
    const col = mongoose.connection.collection(collection);
    const filter = { $or: fields.map((f) => ({ [f]: { $exists: true } })) };
    const result = await col.updateMany(filter, {
      $unset: Object.fromEntries(fields.map((f) => [f, ""])),
    });
    console.log(`${collection}: removed OTP fields from ${result.modifiedCount} document(s).`);
  }

  await disconnectDatabase();
}

main().catch(async (err) => {
  console.error("Migration failed:", err);
  await disconnectDatabase().catch(() => undefined);
  process.exit(1);
});
