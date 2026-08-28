import { env, isBkashConfigured } from "./env";
import { ApiError } from "../utils/ApiError";

export { isBkashConfigured };

/**
 * Low-level bKash Tokenized Checkout gateway client. Nothing above this file
 * ever sees `BKASH_USERNAME`/`BKASH_PASSWORD`/`BKASH_APP_KEY`/
 * `BKASH_APP_SECRET` or a grant token — the service layer only ever receives
 * the safe fields below. Credentials are never logged, never returned, and
 * never sent to the client.
 *
 * Graceful-degrade, same shape as `isCloudinaryConfigured`/`isSmsConfigured`:
 * with no credentials configured every call throws a clear 503 rather than a
 * confusing network error. Real credentials will be provisioned later.
 */

/** What bKash's `POST /create` gives back that is safe to hand the customer. */
export interface BkashCreatePaymentResult {
  paymentID: string;
  /** The hosted bKash checkout page the customer is sent to. */
  bkashURL: string;
  /** bKash echoes the merchant reference back — used to re-verify the order link. */
  merchantInvoiceNumber?: string;
  amount: string;
  currency: string;
  /** "Initiated" on success. */
  transactionStatus?: string;
}

/** What `POST /execute` and `GET /payment/status` both return. */
export interface BkashPaymentStatusResult {
  paymentID: string;
  /** bKash's own transaction id — only present once the payment completed. */
  trxID?: string;
  /** "Completed" | "Initiated" | "Cancelled" | "Failed" — bKash's own vocabulary. */
  transactionStatus?: string;
  amount?: string;
  currency?: string;
  merchantInvoiceNumber?: string;
  /** Present on a failed/refused payment. */
  statusCode?: string;
  statusMessage?: string;
  errorCode?: string;
  errorMessage?: string;
}

function notConfigured(): ApiError {
  return new ApiError(
    503,
    "bKash payments are not available yet — gateway credentials have not been configured on the server. Set BKASH_BASE_URL, BKASH_USERNAME, BKASH_PASSWORD, BKASH_APP_KEY and BKASH_APP_SECRET in the backend .env file."
  );
}

/**
 * bKash grant tokens are valid for ~1 hour. Cached in-process and refreshed a
 * minute early. Per-process like the role/permission cache — a multi-instance
 * deploy simply fetches one token per instance, which bKash allows.
 */
let cachedToken: { token: string; expiresAt: number } | null = null;

/** Exposed for tests — clears the in-process grant-token cache. */
export function resetBkashTokenCache(): void {
  cachedToken = null;
}

function apiUrl(path: string): string {
  return `${env.BKASH_BASE_URL.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

async function readJson(res: Response, context: string): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new ApiError(502, `bKash ${context} failed — the gateway returned an unreadable response.`);
  }
  if (!body || typeof body !== "object") {
    throw new ApiError(502, `bKash ${context} failed — the gateway returned an unexpected response.`);
  }
  return body as Record<string, unknown>;
}

async function getGrantToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.token;

  const res = await fetch(apiUrl("tokenized/checkout/token/grant"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      username: env.BKASH_USERNAME,
      password: env.BKASH_PASSWORD,
    },
    body: JSON.stringify({ app_key: env.BKASH_APP_KEY, app_secret: env.BKASH_APP_SECRET }),
  }).catch(() => {
    throw new ApiError(502, "Could not reach the bKash gateway. Please try again.");
  });

  const body = await readJson(res, "authentication");
  const token = typeof body.id_token === "string" ? body.id_token : undefined;
  if (!token) {
    // Deliberately does not echo the gateway body — it can contain the app key.
    throw new ApiError(502, "bKash authentication failed. Please try again later.");
  }

  const expiresInSeconds = typeof body.expires_in === "number" ? body.expires_in : 3600;
  cachedToken = { token, expiresAt: Date.now() + Math.max(0, expiresInSeconds - 60) * 1000 };
  return token;
}

async function authorizedRequest(
  path: string,
  method: "POST" | "GET",
  payload: Record<string, unknown> | undefined,
  context: string
): Promise<Record<string, unknown>> {
  const token = await getGrantToken();
  const res = await fetch(apiUrl(path), {
    method,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: token,
      "X-APP-Key": env.BKASH_APP_KEY,
    },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  }).catch(() => {
    throw new ApiError(502, "Could not reach the bKash gateway. Please try again.");
  });

  return readJson(res, context);
}

function toStatusResult(body: Record<string, unknown>): BkashPaymentStatusResult {
  const str = (key: string) => (typeof body[key] === "string" ? (body[key] as string) : undefined);
  return {
    paymentID: str("paymentID") ?? "",
    trxID: str("trxID"),
    transactionStatus: str("transactionStatus"),
    amount: str("amount"),
    currency: str("currency"),
    merchantInvoiceNumber: str("merchantInvoiceNumber"),
    statusCode: str("statusCode"),
    statusMessage: str("statusMessage"),
    errorCode: str("errorCode"),
    errorMessage: str("errorMessage"),
  };
}

/**
 * Creates a bKash payment. `amount` is always the server-computed order total
 * — a client-supplied amount never reaches this function (see
 * `payment.service.ts`).
 */
export async function createBkashPayment(input: {
  amountBDT: number;
  merchantInvoiceNumber: string;
  callbackURL: string;
  payerReference: string;
}): Promise<BkashCreatePaymentResult> {
  if (!isBkashConfigured) throw notConfigured();

  const body = await authorizedRequest(
    "tokenized/checkout/create",
    "POST",
    {
      mode: "0011",
      payerReference: input.payerReference,
      callbackURL: input.callbackURL,
      amount: input.amountBDT.toFixed(2),
      currency: "BDT",
      intent: "sale",
      merchantInvoiceNumber: input.merchantInvoiceNumber,
    },
    "payment creation"
  );

  const paymentID = typeof body.paymentID === "string" ? body.paymentID : undefined;
  const bkashURL = typeof body.bkashURL === "string" ? body.bkashURL : undefined;
  if (!paymentID || !bkashURL) {
    const message = typeof body.statusMessage === "string" ? body.statusMessage : "Please try again.";
    throw new ApiError(502, `bKash could not start this payment. ${message}`);
  }

  return {
    paymentID,
    bkashURL,
    merchantInvoiceNumber:
      typeof body.merchantInvoiceNumber === "string" ? body.merchantInvoiceNumber : undefined,
    amount: typeof body.amount === "string" ? body.amount : input.amountBDT.toFixed(2),
    currency: typeof body.currency === "string" ? body.currency : "BDT",
    transactionStatus: typeof body.transactionStatus === "string" ? body.transactionStatus : undefined,
  };
}

/** Executes a payment the customer has authorised on bKash's hosted page. */
export async function executeBkashPayment(paymentID: string): Promise<BkashPaymentStatusResult> {
  if (!isBkashConfigured) throw notConfigured();
  const body = await authorizedRequest(
    "tokenized/checkout/execute",
    "POST",
    { paymentID },
    "payment execution"
  );
  return toStatusResult(body);
}

/**
 * Queries a payment's authoritative state directly from bKash. Used as the
 * fallback whenever `execute` was already consumed (a refreshed/replayed
 * callback), so a genuinely-completed payment is still recognised.
 */
export async function queryBkashPayment(paymentID: string): Promise<BkashPaymentStatusResult> {
  if (!isBkashConfigured) throw notConfigured();
  const body = await authorizedRequest(
    "tokenized/checkout/payment/status",
    "POST",
    { paymentID },
    "payment status query"
  );
  return toStatusResult(body);
}
