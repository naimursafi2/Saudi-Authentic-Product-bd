"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CircleAlert, CircleCheck, CircleX, Loader2 } from "lucide-react";
import { cancelBkashPayment, createBkashPayment, executeBkashPayment } from "@/lib/api/payments";
import { ApiClientError } from "@/lib/api/client";
import { formatBDT } from "@/lib/utils";
import { Button, ButtonLink } from "@/components/ui/Button";
import type { ApiPayment } from "@/types/api";

/**
 * Where the order being paid for is remembered across the round trip to
 * bKash's hosted page. bKash controls the return URL's query string, so the
 * order can't be smuggled through it — sessionStorage survives the redirect,
 * dies with the tab, and is only ever used to offer a Retry button. Nothing
 * here is trusted for anything financial: the backend re-derives the order,
 * the amount and the payment state from its own records.
 */
export const BKASH_PENDING_ORDER_KEY = "sap:bkash-pending-order";

interface PendingOrder {
  orderId: string;
  orderNumber: string;
}

function readPendingOrder(): PendingOrder | null {
  try {
    const raw = window.sessionStorage.getItem(BKASH_PENDING_ORDER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingOrder>;
    if (!parsed.orderId || !parsed.orderNumber) return null;
    return { orderId: parsed.orderId, orderNumber: parsed.orderNumber };
  } catch {
    return null;
  }
}

type Phase =
  | { kind: "verifying" }
  | { kind: "success"; payment: ApiPayment; orderNumber: string }
  | { kind: "failed"; message: string }
  | { kind: "cancelled" }
  | { kind: "error"; message: string };

export function BkashCallbackClient() {
  return (
    <Suspense fallback={<Verifying />}>
      <BkashCallbackContent />
    </Suspense>
  );
}

function BkashCallbackContent() {
  const searchParams = useSearchParams();
  const paymentID = searchParams.get("paymentID");
  const gatewayStatus = searchParams.get("status");

  const [phase, setPhase] = useState<Phase>({ kind: "verifying" });
  const [isRetrying, setIsRetrying] = useState(false);
  // Captured once at mount, before `resolve()` clears the key on success —
  // this only decides whether a Retry button is offered, never anything
  // financial.
  const pendingOrder = useMemo(
    () => (typeof window === "undefined" ? null : readPendingOrder()),
    []
  );
  // Effects mount twice in React's development strict mode; verification must run once.
  const hasRun = useRef(false);

  const resolve = useCallback(async () => {
    if (!paymentID) {
      setPhase({ kind: "error", message: "This payment link is incomplete or has already been used." });
      return;
    }

    if (gatewayStatus === "cancel") {
      try {
        await cancelBkashPayment(paymentID);
      } catch {
        // The record may already be closed — the customer still sees the
        // cancelled state either way, which is what matters here.
      }
      setPhase({ kind: "cancelled" });
      return;
    }

    try {
      const { data } = await executeBkashPayment(paymentID);
      window.sessionStorage.removeItem(BKASH_PENDING_ORDER_KEY);
      setPhase({ kind: "success", payment: data.payment, orderNumber: data.order.orderNumber });
    } catch (err) {
      if (err instanceof ApiClientError) {
        setPhase({ kind: "failed", message: err.message });
        return;
      }
      setPhase({
        kind: "error",
        message: "We could not reach our servers to confirm this payment. Please check your connection.",
      });
    }
  }, [paymentID, gatewayStatus]);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;
    void resolve();
  }, [resolve]);

  async function handleRetry() {
    if (!pendingOrder) return;
    setIsRetrying(true);
    try {
      const { data } = await createBkashPayment(pendingOrder.orderId);
      window.location.assign(data.payment.bkashURL);
    } catch (err) {
      setIsRetrying(false);
      setPhase({
        kind: "error",
        message:
          err instanceof ApiClientError
            ? err.message
            : "We could not start a new payment. Please try again from your account.",
      });
    }
  }

  if (phase.kind === "verifying") return <Verifying />;

  if (phase.kind === "success") {
    const orderNumber = phase.orderNumber || pendingOrder?.orderNumber;
    return (
      <Shell
        icon={<CircleCheck size={44} className="text-green-900" />}
        title="Payment Successful"
        description="Thank you. We have verified your payment with bKash and your order is confirmed."
      >
        <dl className="w-full rounded-lg border border-brown-600/10 bg-surface p-5 text-sm">
          <Row label="Order Number" value={orderNumber ?? "—"} />
          <Row label="Amount Paid" value={formatBDT(phase.payment.amountBDT)} />
          <Row label="Payment Method" value="bKash" />
          <Row label="Transaction ID" value={phase.payment.transactionId ?? "—"} mono />
        </dl>
        <div className="flex flex-wrap justify-center gap-3">
          <ButtonLink href="/account" variant="primary" size="md">
            View Order
          </ButtonLink>
          <ButtonLink href="/shop" variant="outline" size="md">
            Continue Shopping
          </ButtonLink>
        </div>
      </Shell>
    );
  }

  if (phase.kind === "cancelled") {
    return (
      <Shell
        icon={<CircleAlert size={44} className="text-gold-600" />}
        title="Payment Cancelled"
        description="You cancelled the payment on bKash, so nothing has been charged. Your order is still waiting and remains unpaid."
      >
        <Actions
          pendingOrder={pendingOrder}
          isRetrying={isRetrying}
          onRetry={handleRetry}
          backLabel="Back to Order"
        />
      </Shell>
    );
  }

  if (phase.kind === "failed") {
    return (
      <Shell
        icon={<CircleX size={44} className="text-danger" />}
        title="Payment Failed"
        description={phase.message}
      >
        <Actions
          pendingOrder={pendingOrder}
          isRetrying={isRetrying}
          onRetry={handleRetry}
          backLabel="Back to Order"
        />
      </Shell>
    );
  }

  return (
    <Shell
      icon={<CircleAlert size={44} className="text-danger" />}
      title="Something Went Wrong"
      description={phase.message}
    >
      <Actions
        pendingOrder={pendingOrder}
        isRetrying={isRetrying}
        onRetry={handleRetry}
        backLabel="Back to Order"
      />
    </Shell>
  );
}

function Verifying() {
  return (
    <Shell
      icon={<Loader2 size={44} className="animate-spin text-green-900" />}
      title="Confirming your payment..."
      description="We are verifying this transaction directly with bKash. Please don't close this page."
    />
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
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-6 py-20 text-center">
      {icon}
      <h1 className="font-serif text-3xl text-green-950">{title}</h1>
      <p className="text-sm text-brown-500">{description}</p>
      {children}
    </div>
  );
}

function Actions({
  pendingOrder,
  isRetrying,
  onRetry,
  backLabel,
}: {
  pendingOrder: PendingOrder | null;
  isRetrying: boolean;
  onRetry: () => void;
  backLabel: string;
}) {
  return (
    <div className="flex flex-wrap justify-center gap-3">
      {pendingOrder && (
        <Button variant="gold" size="md" onClick={onRetry} disabled={isRetrying}>
          {isRetrying ? "Connecting to bKash..." : "Retry Payment"}
        </Button>
      )}
      <ButtonLink href="/account" variant="outline" size="md">
        {backLabel}
      </ButtonLink>
    </div>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-brown-600/10 py-2 last:border-none">
      <dt className="text-xs font-bold uppercase tracking-[0.06em] text-brown-500">{label}</dt>
      <dd className={`text-sm font-semibold text-green-950 ${mono ? "font-mono text-xs" : ""}`}>{value}</dd>
    </div>
  );
}
