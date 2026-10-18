import { env, isSslcommerzConfigured } from "./env";
import { ApiError } from "../utils/ApiError";

export { isSslcommerzConfigured };

/**
 * Low-level SSLCommerz gateway client. Nothing above this file ever sees
 * `SSLCOMMERZ_STORE_ID` / `SSLCOMMERZ_STORE_PASSWORD` — the service layer only
 * receives the safe fields below. Credentials are never logged, never
 * returned, and never sent to the browser.
 *
 * Graceful-degrade: with no credentials configured every call throws a clear
 * 503 instead of a confusing network error, same as Cloudinary/SMTP/SMS.
 *
 * `SSLCOMMERZ_IS_LIVE=true` switches from the sandbox to the live gateway.
 */

const SANDBOX_BASE = "https://sandbox.sslcommerz.com";
const LIVE_BASE = "https://securepay.sslcommerz.com";

function baseUrl(): string {
  return env.SSLCOMMERZ_IS_LIVE ? LIVE_BASE : SANDBOX_BASE;
}

function notConfigured(): ApiError {
  return new ApiError(
    503,
    "Online payment is not available yet — SSLCommerz credentials have not been configured on the server. Set SSLCOMMERZ_STORE_ID and SSLCOMMERZ_STORE_PASSWORD in the backend .env file."
  );
}

export interface SslcommerzInitInput {
  tranId: string;
  amountBDT: number;
  successUrl: string;
  failUrl: string;
  cancelUrl: string;
  ipnUrl: string;
  customer: {
    name: string;
    email: string;
    phone: string;
    address: string;
    city: string;
  };
  productName: string;
  numOfItems: number;
  /** Echoed back on every callback/validation — used to cross-check the payment record. */
  valueA?: string;
}

export interface SslcommerzInitResult {
  /** The hosted SSLCommerz checkout page the customer is sent to. */
  gatewayUrl: string;
  sessionKey?: string;
}

/**
 * One transaction as SSLCommerz reports it — from the validation API (by
 * `val_id`) or one `element` of the transaction query API (by `tran_id`).
 */
export interface SslcommerzTransaction {
  /** "VALID" | "VALIDATED" | "PENDING" | "FAILED" | "CANCELLED" | "INVALID_TRANSACTION" | ... */
  status?: string;
  tranId?: string;
  valId?: string;
  amount?: string;
  currency?: string;
  bankTranId?: string;
  cardType?: string;
  valueA?: string;
  /** "0" safe, "1" high risk. */
  riskLevel?: string;
  riskTitle?: string;
  tranDate?: string;
  error?: string;
}

/** SSLCommerz considers both of these a successful, settled payment. */
export function isSuccessfulStatus(status: string | undefined): boolean {
  return status === "VALID" || status === "VALIDATED";
}

async function readJson(res: Response, context: string): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new ApiError(502, `SSLCommerz ${context} failed — the gateway returned an unreadable response.`);
  }
  if (!body || typeof body !== "object") {
    throw new ApiError(502, `SSLCommerz ${context} failed — the gateway returned an unexpected response.`);
  }
  return body as Record<string, unknown>;
}

function str(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return String(value);
}

function toTransaction(raw: Record<string, unknown>): SslcommerzTransaction {
  return {
    status: str(raw.status),
    tranId: str(raw.tran_id),
    valId: str(raw.val_id),
    amount: str(raw.amount),
    currency: str(raw.currency_type) ?? str(raw.currency),
    bankTranId: str(raw.bank_tran_id),
    cardType: str(raw.card_type),
    valueA: str(raw.value_a),
    riskLevel: str(raw.risk_level),
    riskTitle: str(raw.risk_title),
    tranDate: str(raw.tran_date),
    error: str(raw.error),
  };
}

/** Creates a hosted-checkout session. */
export async function initSslcommerzPayment(input: SslcommerzInitInput): Promise<SslcommerzInitResult> {
  if (!isSslcommerzConfigured) throw notConfigured();

  const form = new URLSearchParams({
    store_id: env.SSLCOMMERZ_STORE_ID,
    store_passwd: env.SSLCOMMERZ_STORE_PASSWORD,
    total_amount: input.amountBDT.toFixed(2),
    currency: "BDT",
    tran_id: input.tranId,
    success_url: input.successUrl,
    fail_url: input.failUrl,
    cancel_url: input.cancelUrl,
    ipn_url: input.ipnUrl,
    cus_name: input.customer.name,
    cus_email: input.customer.email,
    cus_phone: input.customer.phone,
    cus_add1: input.customer.address,
    cus_city: input.customer.city,
    cus_country: "Bangladesh",
    shipping_method: "NO",
    num_of_item: String(input.numOfItems),
    product_name: input.productName.slice(0, 250),
    product_category: "General",
    product_profile: "general",
  });
  if (input.valueA) form.set("value_a", input.valueA);

  let res: Response;
  try {
    res = await fetch(`${baseUrl()}/gwprocess/v4/api.php`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
    });
  } catch {
    throw new ApiError(502, "Could not reach SSLCommerz. Please try again in a moment.");
  }

  const body = await readJson(res, "session creation");
  const gatewayUrl = str(body.GatewayPageURL);
  if (body.status !== "SUCCESS" || !gatewayUrl) {
    // `failedreason` is SSLCommerz's own human-readable reason (e.g. a bad
    // store id) — safe to log, never contains the password.
    console.error("[sslcommerz] session creation refused:", str(body.failedreason) ?? "unknown reason");
    throw new ApiError(502, "SSLCommerz could not start this payment. Please try again in a moment.");
  }

  return { gatewayUrl, sessionKey: str(body.sessionkey) };
}

/** Authoritative check of one completed attempt, by the `val_id` SSLCommerz posted back. */
export async function validateSslcommerzPayment(valId: string): Promise<SslcommerzTransaction> {
  if (!isSslcommerzConfigured) throw notConfigured();

  const qs = new URLSearchParams({
    val_id: valId,
    store_id: env.SSLCOMMERZ_STORE_ID,
    store_passwd: env.SSLCOMMERZ_STORE_PASSWORD,
    format: "json",
  });

  let res: Response;
  try {
    res = await fetch(`${baseUrl()}/validator/api/validationserverAPI.php?${qs.toString()}`);
  } catch {
    throw new ApiError(502, "Could not reach SSLCommerz to verify this payment.");
  }
  return toTransaction(await readJson(res, "validation"));
}

/**
 * Every attempt SSLCommerz knows about for one of our `tran_id`s — used by
 * the reconciliation sweep and to double-check a fail/cancel callback.
 * Returns an empty list when the gateway has no record of the transaction.
 */
export async function querySslcommerzTransaction(tranId: string): Promise<SslcommerzTransaction[]> {
  if (!isSslcommerzConfigured) throw notConfigured();

  const qs = new URLSearchParams({
    tran_id: tranId,
    store_id: env.SSLCOMMERZ_STORE_ID,
    store_passwd: env.SSLCOMMERZ_STORE_PASSWORD,
    format: "json",
  });

  let res: Response;
  try {
    res = await fetch(`${baseUrl()}/validator/api/merchantTransIDvalidationAPI.php?${qs.toString()}`);
  } catch {
    throw new ApiError(502, "Could not reach SSLCommerz to look up this payment.");
  }

  const body = await readJson(res, "transaction query");
  if (body.APIConnect !== "DONE") {
    throw new ApiError(502, `SSLCommerz transaction query failed (${str(body.APIConnect) ?? "unknown"}).`);
  }
  const elements = Array.isArray(body.element) ? body.element : [];
  return elements
    .filter((e): e is Record<string, unknown> => Boolean(e) && typeof e === "object")
    .map(toTransaction);
}
