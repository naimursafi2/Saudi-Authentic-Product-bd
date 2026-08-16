"use client";

import { Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  CreditCard,
  MapPin,
  PackageSearch,
  Settings2,
  Truck,
} from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Button } from "@/components/ui/Button";
import { trackOrder } from "@/lib/api/orders";
import { ApiClientError } from "@/lib/api/client";
import { useAuth } from "@/context/AuthContext";
import { cn, formatBDT } from "@/lib/utils";
import type { ApiOrder, OrderStatus } from "@/types/api";

const STATUS_STEPS: { status: OrderStatus; label: string; icon: typeof Clock }[] = [
  { status: "pending", label: "Order Placed", icon: Clock },
  { status: "processing", label: "Processing", icon: Settings2 },
  { status: "shipped", label: "Shipped", icon: Truck },
  { status: "delivered", label: "Delivered", icon: CheckCircle2 },
];

const PAYMENT_LABELS: Record<ApiOrder["paymentMethod"], string> = {
  cod: "Cash on Delivery",
  bkash: "bKash",
  nagad: "Nagad",
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function TrackOrderForm() {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [orderNumber, setOrderNumber] = useState(searchParams.get("orderNumber") ?? "");
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<ApiOrder | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const autoSubmitted = useRef(false);

  // Prefill from the logged-in customer's own account, but never overwrite
  // something the visitor already typed themselves.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (user?.email && !email) setEmail(user.email);
  }, [user, email]);

  async function performSearch(orderNumberValue: string, emailValue: string) {
    setIsLoading(true);
    setError(null);
    setOrder(null);
    try {
      const { data } = await trackOrder(orderNumberValue.trim(), emailValue.trim());
      setOrder(data.order);
    } catch (err) {
      const message =
        err instanceof ApiClientError && err.statusCode !== 400
          ? err.message
          : "We couldn't find an order matching that Order ID and email. Please double-check both and try again.";
      setError(message);
    } finally {
      setIsLoading(false);
      setHasSearched(true);
    }
  }

  // Auto-run the search when both fields are already known (e.g. arriving
  // here via a "Track Order" link from an order card in the account page).
  useEffect(() => {
    if (!autoSubmitted.current && orderNumber.trim() && email.trim()) {
      autoSubmitted.current = true;
      void performSearch(orderNumber, email);
    }
  }, [orderNumber, email]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    void performSearch(orderNumber, email);
  }

  const currentStepIndex = order ? STATUS_STEPS.findIndex((s) => s.status === order.status) : -1;
  const isCancelled = order?.status === "cancelled";

  return (
    <div className="mx-auto max-w-[900px] px-6 py-14 sm:px-10 lg:px-16">
      <div className="mb-10 text-center">
        <SectionHeading title="Track Your Order" />
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-brown-600">
          Enter your Order ID and the email address used at checkout to see live status,
          items, and delivery details.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="mb-10 grid grid-cols-1 gap-4 rounded-lg border border-brown-600/10 bg-white p-6 shadow-[0_1px_2px_rgba(61,43,31,0.04)] sm:grid-cols-2"
      >
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.06em] text-brown-600">
            Order ID
          </label>
          <input
            required
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
            placeholder="e.g. SAP-20260816-1234"
            className="w-full rounded border border-green-900/15 bg-cream-50 px-3.5 py-2.5 text-sm text-green-950 placeholder:text-brown-500/50 focus:border-green-900/40 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.06em] text-brown-600">
            Email Address
          </label>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded border border-green-900/15 bg-cream-50 px-3.5 py-2.5 text-sm text-green-950 placeholder:text-brown-500/50 focus:border-green-900/40 focus:outline-none"
          />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" variant="primary" size="md" disabled={isLoading} className="w-full sm:w-auto">
            {isLoading ? "Searching…" : "Track Order"}
          </Button>
        </div>
      </form>

      {error && (
        <div className="mb-10 flex items-start gap-3 rounded-lg border border-[#f0c9c3] bg-[#fbeceb] p-4 text-sm text-[#8a4a3f]">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {!order && !error && !hasSearched && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-brown-500/30 py-16 text-center">
          <PackageSearch size={32} className="text-brown-500/50" />
          <p className="text-sm text-brown-500">
            Your order status, items, and delivery details will appear here.
          </p>
        </div>
      )}

      {order && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-brown-600/10 bg-white p-6 shadow-[0_1px_2px_rgba(61,43,31,0.04)]">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-brown-500">Order ID</p>
              <p className="font-serif text-xl text-green-950">#{order.orderNumber}</p>
              <p className="mt-1 text-xs text-brown-500">Placed on {formatDateTime(order.createdAt)}</p>
            </div>
            <span
              className={cn(
                "rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-[0.08em]",
                isCancelled ? "bg-[#fbeceb] text-[#8a4a3f]" : "bg-green-900 text-white"
              )}
            >
              {order.status}
            </span>
          </div>

          {isCancelled ? (
            <div className="flex items-start gap-3 rounded-lg border border-[#f0c9c3] bg-[#fbeceb] p-5 text-sm text-[#8a4a3f]">
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <p>
                This order was cancelled
                {order.statusHistory.length > 0
                  ? ` on ${formatDateTime(order.statusHistory[order.statusHistory.length - 1].at)}`
                  : ""}
                . Contact us if you believe this is a mistake.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-brown-600/10 bg-white p-6 shadow-[0_1px_2px_rgba(61,43,31,0.04)]">
              <div className="flex items-start justify-between">
                {STATUS_STEPS.map((step, i) => {
                  const reached = i <= currentStepIndex;
                  const Icon = step.icon;
                  return (
                    <div key={step.status} className="flex flex-1 flex-col items-center text-center">
                      <div className="flex w-full items-center">
                        <div
                          className={cn(
                            "h-0.5 flex-1",
                            i === 0 ? "invisible" : reached ? "bg-green-900" : "bg-cream-300"
                          )}
                        />
                        <div
                          className={cn(
                            "flex size-9 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                            reached
                              ? "border-green-900 bg-green-900 text-white"
                              : "border-cream-300 bg-cream-50 text-brown-500/60"
                          )}
                        >
                          <Icon size={16} />
                        </div>
                        <div
                          className={cn(
                            "h-0.5 flex-1",
                            i === STATUS_STEPS.length - 1
                              ? "invisible"
                              : i < currentStepIndex
                                ? "bg-green-900"
                                : "bg-cream-300"
                          )}
                        />
                      </div>
                      <p
                        className={cn(
                          "mt-2 text-[11px] font-bold uppercase tracking-[0.06em]",
                          reached ? "text-green-950" : "text-brown-500/60"
                        )}
                      >
                        {step.label}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="rounded-lg border border-brown-600/10 bg-white p-6 shadow-[0_1px_2px_rgba(61,43,31,0.04)]">
              <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.08em] text-brown-600">
                <CreditCard size={14} /> Payment
              </p>
              <div className="flex flex-col gap-1.5 text-sm text-green-950">
                <p>Method: {PAYMENT_LABELS[order.paymentMethod]}</p>
                <p>
                  Status:{" "}
                  <span className={order.isPaid ? "font-semibold text-green-900" : "font-semibold text-brown-500"}>
                    {order.isPaid ? "Paid" : "Unpaid"}
                  </span>
                </p>
              </div>
            </div>
            <div className="rounded-lg border border-brown-600/10 bg-white p-6 shadow-[0_1px_2px_rgba(61,43,31,0.04)]">
              <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.08em] text-brown-600">
                <MapPin size={14} /> Delivery
              </p>
              <div className="flex flex-col gap-1.5 text-sm text-green-950">
                <p>Method: {order.deliveryMethod === "express" ? "Express" : "Standard"}</p>
                <p>
                  {order.shippingAddress.fullAddress}, {order.shippingAddress.cityArea},{" "}
                  {order.shippingAddress.district}
                </p>
                <p className="text-brown-600">{order.shippingAddress.phone}</p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-brown-600/10 bg-white p-6 shadow-[0_1px_2px_rgba(61,43,31,0.04)]">
            <p className="mb-4 text-xs font-bold uppercase tracking-[0.08em] text-brown-600">
              Items ({order.items.length})
            </p>
            <ul className="flex flex-col divide-y divide-brown-600/10">
              {order.items.map((item) => (
                <li key={`${item.product}-${item.variantId}`} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <p className="text-sm font-semibold text-green-950">{item.productName}</p>
                    <p className="text-xs text-brown-500">
                      {item.variantLabel} · Qty {item.quantity} × {formatBDT(item.unitPriceBDT)}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-green-950">{formatBDT(item.lineTotalBDT)}</p>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-col gap-1.5 border-t border-brown-600/10 pt-4 text-sm">
              <div className="flex items-center justify-between text-brown-600">
                <span>Subtotal</span>
                <span>{formatBDT(order.subtotalBDT)}</span>
              </div>
              <div className="flex items-center justify-between text-brown-600">
                <span>Shipping</span>
                <span>{formatBDT(order.shippingFeeBDT)}</span>
              </div>
              <div className="flex items-center justify-between text-base font-semibold text-green-950">
                <span>Total</span>
                <span>{formatBDT(order.totalBDT)}</span>
              </div>
            </div>
          </div>

          {order.statusHistory.length > 0 && (
            <div className="rounded-lg border border-brown-600/10 bg-white p-6 shadow-[0_1px_2px_rgba(61,43,31,0.04)]">
              <p className="mb-4 text-xs font-bold uppercase tracking-[0.08em] text-brown-600">Order Timeline</p>
              <ul className="flex flex-col gap-3">
                {[...order.statusHistory].reverse().map((entry, i) => (
                  <li key={`${entry.status}-${entry.at}-${i}`} className="flex items-start justify-between gap-3 text-sm">
                    <span className="font-semibold capitalize text-green-950">{entry.status}</span>
                    <span className="text-right text-xs text-brown-500">{formatDateTime(entry.at)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function TrackOrderPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-[900px] px-6 py-24" />}>
      <TrackOrderForm />
    </Suspense>
  );
}
