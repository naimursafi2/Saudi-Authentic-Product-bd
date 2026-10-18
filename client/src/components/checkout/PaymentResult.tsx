"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CircleAlert, CircleCheck, CircleX, Loader2 } from "lucide-react";
import { getPaymentForOrder, initSslcommerzPayment } from "@/lib/api/payments";
import { ApiClientError } from "@/lib/api/client";
import { formatBDT, cn } from "@/lib/utils";
import { Button, ButtonLink } from "@/components/ui/Button";
import type { ApiPayment } from "@/types/api";

/**
 * The page a customer lands on after SSLCommerz. The server has already
 * verified the transaction with SSLCommerz (server-to-server) before
 * redirecting here, so the page only *shows* the result — nothing on it is
 * trusted for anything financial. The query string carries `orderId`,
 * `order` (order number) and, for failures, a `reason` code.
 *
 * Like most storefronts, the result stays on screen for a few seconds and
 * then moves on by itself: to the customer's orders after success, and to
 * their orders (where an unpaid order can be paid again) after a failure or
 * cancellation. Pressing any button cancels the automatic redirect.
 */

export type PaymentResultKind = "success" | "failed" | "cancelled";

const REDIRECT_SECONDS = 4;
const REDIRECT_TO = "/account";

const FAILURE_REASONS: Record<string, string> = {
  verification_pending:
    "We are still confirming this payment with your bank. If money was deducted, your order will update automatically within a few minutes — please don't pay again yet.",
  verification_failed:
    "SSLCommerz could not confirm this payment, so nothing has been charged. Your order is saved and still unpaid.",
  closed: "This payment attempt has already been closed. You can start a new payment for your order.",
  unknown_payment: "We could not match this payment to an order. If money was deducted, please contact us.",
};

export function PaymentResult({ kind }: { kind: PaymentResultKind }) {
  return (
    <Suspense fallback={<Shell icon={<Loader2 size={48} className="animate-spin text-green-900" />} title="Loading..." />}>
      <PaymentResultContent kind={kind} />
    </Suspense>
  );
}

function PaymentResultContent({ kind }: { kind: PaymentResultKind }) {
  const router = useRouter();
  const params = useSearchParams();
  const orderId = params.get("orderId");
  const orderNumber = params.get("order");
  const reason = params.get("reason");

  const [secondsLeft, setSecondsLeft] = useState(REDIRECT_SECONDS);
  const [autoRedirect, setAutoRedirect] = useState(true);
  const [payment, setPayment] = useState<ApiPayment | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const hasFetched = useRef(false);

  // Extra details (amount, transaction id) for the success receipt. Optional:
  // if the customer's session isn't available the page still works.
  useEffect(() => {
    if (kind !== "success" || !orderId || hasFetched.current) return;
    hasFetched.current = true;
    getPaymentForOrder(orderId)
      .then(({ data }) => setPayment(data.payment))
      .catch(() => setPayment(null));
  }, [kind, orderId]);

  // A payment still being verified must not bounce the customer away before
  // they have read that they shouldn't pay twice.
  const shouldRedirect = autoRedirect && reason !== "verification_pending";

  useEffect(() => {
    if (!shouldRedirect) return;
    if (secondsLeft <= 0) {
      router.replace(REDIRECT_TO);
      return;
    }
    const timer = window.setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [secondsLeft, shouldRedirect, router]);

  async function handleRetry() {
    if (!orderId) return;
    setAutoRedirect(false);
    setRetryError(null);
    setIsRetrying(true);
    try {
      const { data } = await initSslcommerzPayment(orderId);
      window.location.assign(data.payment.gatewayUrl);
    } catch (err) {
      setIsRetrying(false);
      setRetryError(
        err instanceof ApiClientError
          ? err.message
          : "We could not start a new payment. Please try again from your orders."
      );
    }
  }

  const countdown = shouldRedirect ? (
    <Countdown secondsLeft={secondsLeft} total={REDIRECT_SECONDS} tone={kind} />
  ) : null;

  if (kind === "success") {
    return (
      <Shell
        icon={<CircleCheck size={56} className="text-green-900" />}
        title="Payment Successful"
        description="Thank you! Your payment has been verified and your order is confirmed. A confirmation email is on its way."
      >
        <dl className="w-full rounded-lg border border-brown-600/10 bg-surface p-5 text-left text-sm">
          <Row label="Order Number" value={orderNumber ?? payment?.merchantInvoiceNumber ?? "—"} />
          {payment && <Row label="Amount Paid" value={formatBDT(payment.amountBDT)} />}
          <Row label="Payment Method" value="Online (SSLCommerz)" />
          {payment?.transactionId && <Row label="Transaction ID" value={payment.transactionId} mono />}
        </dl>
        {countdown}
        <div className="flex flex-wrap justify-center gap-3">
          <ButtonLink href={REDIRECT_TO} variant="primary" size="md">
            View My Orders
          </ButtonLink>
          <ButtonLink href="/shop" variant="outline" size="md">
            Continue Shopping
          </ButtonLink>
        </div>
      </Shell>
    );
  }

  const isCancelled = kind === "cancelled";
  const description = isCancelled
    ? "You cancelled the payment, so nothing has been charged. Your order is saved and still unpaid — you can pay for it any time from your orders."
    : (reason && FAILURE_REASONS[reason]) ??
      "The payment did not go through, so nothing has been charged. Your order is saved and still unpaid.";

  return (
    <Shell
      icon={
        isCancelled ? (
          <CircleAlert size={56} className="text-gold-600" />
        ) : (
          <CircleX size={56} className="text-danger" />
        )
      }
      title={isCancelled ? "Payment Cancelled" : "Payment Failed"}
      description={description}
    >
      {orderNumber && (
        <p className="text-sm text-brown-500">
          Order <span className="font-semibold text-green-950">{orderNumber}</span>
        </p>
      )}
      {retryError && <p className="text-sm text-danger">{retryError}</p>}
      {countdown}
      <div className="flex flex-wrap justify-center gap-3">
        {orderId && reason !== "verification_pending" && reason !== "unknown_payment" && (
          <Button variant="gold" size="md" onClick={handleRetry} disabled={isRetrying}>
            {isRetrying ? "Connecting..." : "Try Again"}
          </Button>
        )}
        <ButtonLink href={REDIRECT_TO} variant="outline" size="md">
          View My Orders
        </ButtonLink>
      </div>
    </Shell>
  );
}

function Countdown({
  secondsLeft,
  total,
  tone,
}: {
  secondsLeft: number;
  total: number;
  tone: PaymentResultKind;
}) {
  const progress = Math.min(100, ((total - secondsLeft) / total) * 100);
  return (
    <div className="flex w-full flex-col items-center gap-2" aria-live="polite">
      <p className="text-xs text-brown-500">
        Redirecting to your orders in{" "}
        <span className="font-semibold text-green-950">{Math.max(secondsLeft, 0)}</span> second
        {secondsLeft === 1 ? "" : "s"}...
      </p>
      <div className="h-1 w-48 overflow-hidden rounded-full bg-brown-600/10">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-1000 ease-linear",
            tone === "success" ? "bg-green-900" : tone === "cancelled" ? "bg-gold-500" : "bg-danger"
          )}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

function Shell({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-5 px-6 py-20 text-center">
      {icon}
      <h1 className="font-serif text-3xl text-green-950">{title}</h1>
      {description && <p className="text-sm text-brown-500">{description}</p>}
      {children}
    </div>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-brown-600/10 py-2 last:border-none">
      <dt className="text-xs font-bold uppercase tracking-[0.06em] text-brown-500">{label}</dt>
      <dd className={cn("text-sm font-semibold text-green-950", mono && "font-mono text-xs")}>{value}</dd>
    </div>
  );
}
