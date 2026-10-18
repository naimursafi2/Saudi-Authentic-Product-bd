import type { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { sendSuccess } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";
import { paramStr } from "../utils/params";
import * as paymentService from "../services/payment.service";
import { OrderModel } from "../models/Order.model";
import { isSslcommerzConfigured } from "../config/sslcommerz";
import { env, missingSslcommerzEnvKeys } from "../config/env";
import type { ListPaymentsQuery } from "../validators/payment.validator";

/** Booleans only — the storefront needs to know which providers are live, never how they are configured. */
export const getPaymentConfig = catchAsync(async (_req: Request, res: Response) => {
  sendSuccess(res, 200, "Payment configuration fetched", {
    providers: { sslcommerz: isSslcommerzConfigured },
  });
});

/**
 * Staff-only diagnostics: explains *why* online payment is absent from
 * checkout and exactly what is missing. Variable names only — no values.
 */
export const getGatewayStatus = catchAsync(async (_req: Request, res: Response) => {
  const missingKeys = missingSslcommerzEnvKeys();
  sendSuccess(res, 200, "Gateway status fetched", {
    sslcommerz: {
      configured: missingKeys.length === 0,
      missingKeys,
      mode: env.SSLCOMMERZ_IS_LIVE ? "live" : "sandbox",
    },
  });
});

export const initSslcommerzPayment = catchAsync(async (req: Request, res: Response) => {
  const payment = await paymentService.initSslcommerzPaymentForOrder(req.body.orderId, {
    id: req.user!.id,
    role: req.user!.role,
  });

  // Only what the customer's browser genuinely needs to continue — the
  // hosted checkout URL. Store credentials never leave the server.
  sendSuccess(res, 201, "Payment session created", {
    payment: {
      id: payment._id.toString(),
      gatewayPaymentId: payment.gatewayPaymentId,
      gatewayUrl: payment.gatewayMetadata?.gatewayUrl,
      amountBDT: payment.amountBDT,
      currency: payment.currency,
      status: payment.status,
    },
  });
});

/** SSLCommerz posts form fields; some setups send them as a query string instead. */
function callbackFields(req: Request): Record<string, unknown> {
  const body = (req.body && typeof req.body === "object" ? req.body : {}) as Record<string, unknown>;
  return Object.keys(body).length > 0 ? body : (req.query as Record<string, unknown>);
}

function redirectToResult(res: Response, outcome: paymentService.CallbackOutcome) {
  res.redirect(
    303,
    paymentService.paymentResultUrl(outcome.page, {
      orderId: outcome.orderId,
      orderNumber: outcome.orderNumber,
      reason: outcome.reason,
    })
  );
}

/**
 * The browser-facing callbacks below never fail with a JSON error — the
 * customer is always redirected to a storefront result page, whatever
 * happened. Verification itself happens server-to-server in the service.
 */
export const sslcommerzSuccessCallback = async (req: Request, res: Response) => {
  try {
    redirectToResult(res, await paymentService.handleSslcommerzSuccess(callbackFields(req)));
  } catch (err) {
    console.error("[payments] success callback error:", (err as Error).message);
    redirectToResult(res, { page: "failed", reason: "verification_pending" });
  }
};

export const sslcommerzFailCallback = async (req: Request, res: Response) => {
  try {
    redirectToResult(res, await paymentService.handleSslcommerzFailOrCancel(callbackFields(req), "failed"));
  } catch (err) {
    console.error("[payments] fail callback error:", (err as Error).message);
    redirectToResult(res, { page: "failed" });
  }
};

export const sslcommerzCancelCallback = async (req: Request, res: Response) => {
  try {
    redirectToResult(res, await paymentService.handleSslcommerzFailOrCancel(callbackFields(req), "cancelled"));
  } catch (err) {
    console.error("[payments] cancel callback error:", (err as Error).message);
    redirectToResult(res, { page: "cancelled" });
  }
};

/** Server-to-server notification from SSLCommerz. Always 200 so the gateway doesn't retry forever. */
export const sslcommerzIpn = async (req: Request, res: Response) => {
  try {
    const { handled } = await paymentService.handleSslcommerzIpn(callbackFields(req));
    res.status(200).json({ success: true, message: handled ? "IPN processed" : "IPN ignored" });
  } catch (err) {
    console.error("[payments] IPN error:", (err as Error).message);
    res.status(200).json({ success: false, message: "IPN could not be processed" });
  }
};

export const listPayments = catchAsync(async (req: Request, res: Response) => {
  const filter = req.query as unknown as ListPaymentsQuery;
  const { payments, pagination } = await paymentService.listPayments(filter);
  sendSuccess(res, 200, "Payments fetched", { payments }, { pagination });
});

/** The order's payment, for the customer's own order page or for staff. */
export const getPaymentForOrder = catchAsync(async (req: Request, res: Response) => {
  const orderId = paramStr(req.params.orderId);
  const order = await OrderModel.findById(orderId).select("customer");
  if (!order) throw ApiError.notFound("Order not found");

  const isOwner = order.customer.toString() === req.user!.id;
  const canViewAny = (req.user!.permissions ?? []).includes("payments.view");
  if (!isOwner && !canViewAny) {
    throw ApiError.forbidden("You do not have permission to view this payment");
  }

  const payment = await paymentService.getPaymentForOrder(orderId);
  sendSuccess(res, 200, "Payment fetched", { payment });
});
