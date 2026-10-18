import { createOtpStore } from "./otp.store";
import { DELIVERY_OTP_TTL_MINUTES } from "../constants/security";

/**
 * Delivery-confirmation OTPs — Redis key `otp:delivery:<orderId>` with a
 * `DELIVERY_OTP_TTL_MINUTES` (5 min) TTL. Nothing OTP-related is stored on
 * the Order document except the permanent `otpVerifiedAt` audit timestamp.
 */
const store = createOtpStore("delivery", DELIVERY_OTP_TTL_MINUTES * 60);

export const saveDeliveryOtp = (orderId: string, code: string) => store.save(orderId, code);
export const getDeliveryOtp = (orderId: string) => store.get(orderId);
export const incrementDeliveryOtpAttempts = (orderId: string) => store.incrementAttempts(orderId);
export const deleteDeliveryOtp = (orderId: string) => store.remove(orderId);
