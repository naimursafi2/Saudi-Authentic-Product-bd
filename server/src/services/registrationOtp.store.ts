import { createOtpStore, __clearMemoryOtps, type StoredOtp } from "./otp.store";
import { REGISTRATION_OTP_TTL_MINUTES } from "../constants/security";

/**
 * Registration email-verification OTPs — Redis key `otp:registration:<email>`
 * with a `REGISTRATION_OTP_TTL_MINUTES` (5 min) TTL. See `otp.store.ts`.
 */
const store = createOtpStore("registration", REGISTRATION_OTP_TTL_MINUTES * 60, (email) =>
  email.trim().toLowerCase()
);

export type StoredRegistrationOtp = StoredOtp;

export const saveRegistrationOtp = (email: string, code: string) => store.save(email, code);
export const getRegistrationOtp = (email: string) => store.get(email);
export const incrementRegistrationOtpAttempts = (email: string) => store.incrementAttempts(email);
export const deleteRegistrationOtp = (email: string) => store.remove(email);

/** Test helper — wipes the in-memory fallback between tests. */
export const __clearMemoryRegistrationOtps = __clearMemoryOtps;
