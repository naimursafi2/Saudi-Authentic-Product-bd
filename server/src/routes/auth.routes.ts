import { Router } from "express";
import * as authController from "../controllers/auth.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import { authLimiter } from "../middlewares/rateLimit.middleware";
import {
  changePasswordSchema,
  disableTwoFactorSchema,
  enableTwoFactorSchema,
  forgotPasswordSchema,
  googleAuthSchema,
  loginSchema,
  registerSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  verifyTwoFactorLoginSchema,
} from "../validators/auth.validator";

const router = Router();

router.post("/register", authLimiter, validate({ body: registerSchema }), authController.register);
router.post("/login", authLimiter, validate({ body: loginSchema }), authController.login);
router.post("/google", authLimiter, validate({ body: googleAuthSchema }), authController.googleAuth);
router.post("/refresh", authLimiter, authController.refresh);
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

// -- Two-factor authentication --
router.post(
  "/2fa/verify",
  authLimiter,
  validate({ body: verifyTwoFactorLoginSchema }),
  authController.verifyTwoFactorLogin
);
router.post("/2fa/setup", authenticate, authController.startTwoFactorSetup);
router.post(
  "/2fa/enable",
  authenticate,
  validate({ body: enableTwoFactorSchema }),
  authController.enableTwoFactor
);
router.post(
  "/2fa/disable",
  authenticate,
  validate({ body: disableTwoFactorSchema }),
  authController.disableTwoFactor
);

export default router;
