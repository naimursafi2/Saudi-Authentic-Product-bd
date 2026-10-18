import express, { Router } from "express";
import * as paymentController from "../controllers/payment.controller";
import { apiLimiter } from "../middlewares/rateLimit.middleware";

/**
 * SSLCommerz's return points. These are hit by the customer's browser as a
 * cross-site form POST from the gateway's own domain (and, for the IPN, by
 * SSLCommerz's servers), so they are mounted in app.ts *before* the CORS
 * allow-list — otherwise the gateway's `Origin` header would be rejected and
 * the customer would land on an error instead of their result page.
 *
 * No authentication, by design: nothing posted here is trusted. The service
 * only uses `tran_id` to find the payment and `val_id` to ask SSLCommerz's
 * validation API, server-to-server, whether the money really moved.
 */
const router = Router();

// Per-route (not router.use) so `/payments/sslcommerz/init`, which falls
// through to the normal authenticated API, isn't parsed or rate-limited twice.
const form = express.urlencoded({ extended: false, limit: "100kb" });

router.all("/success", apiLimiter, form, paymentController.sslcommerzSuccessCallback);
router.all("/fail", apiLimiter, form, paymentController.sslcommerzFailCallback);
router.all("/cancel", apiLimiter, form, paymentController.sslcommerzCancelCallback);
router.post("/ipn", apiLimiter, form, paymentController.sslcommerzIpn);

export default router;
