import { Router } from "express";
import * as authController from "../controllers/auth.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import { authLimiter, sessionLimiter } from "../middlewares/rateLimit.middleware";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  googleAuthSchema,
  loginSchema,
  registerSchema,
  resendRegistrationOtpSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  verifyRegistrationOtpSchema,
} from "../validators/auth.validator";

const router = Router();

router.post("/register", authLimiter, validate({ body: registerSchema }), authController.register);
router.post(
  "/verify-registration-otp",
  authLimiter,
  validate({ body: verifyRegistrationOtpSchema }),
  authController.verifyRegistrationOtp
);
router.post(
  "/resend-registration-otp",
  authLimiter,
  validate({ body: resendRegistrationOtpSchema }),
  authController.resendRegistrationOtp
);
router.post("/login", authLimiter, validate({ body: loginSchema }), authController.login);
router.post("/google", sessionLimiter, validate({ body: googleAuthSchema }), authController.googleAuth);
router.post("/refresh", sessionLimiter, authController.refresh);
router.post("/logout", authController.logout);
router.post("/logout-all", authenticate, authController.logoutAll);
router.get("/me", authenticate, authController.me);
router.patch(
  "/change-password",
  authenticate,
  validate({ body: changePasswordSchema }),
  authController.changePassword
);
router.post(
  "/forgot-password",
  authLimiter,
  validate({ body: forgotPasswordSchema }),
  authController.forgotPassword
);
router.post(
  "/reset-password",
  authLimiter,
  validate({ body: resetPasswordSchema }),
  authController.resetPassword
);
router.post(
  "/verify-email",
  authLimiter,
  validate({ body: verifyEmailSchema }),
  authController.verifyEmail
);
router.post(
  "/resend-verification",
  authLimiter,
  validate({ body: resendVerificationSchema }),
  authController.resendVerification
);

export default router;
