"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Camera, Package, RefreshCcw, Search, Undo2 } from "lucide-react";
import { listMyOrders } from "@/lib/api/orders";
import { createRefund, listRefunds } from "@/lib/api/finance";
import { createReturnRequest, listReturnRequests } from "@/lib/api/returns";
import { PrintInvoiceButton } from "@/components/order/OrderInvoice";
import { ApiClientError } from "@/lib/api/client";
import { formatBDT, cn } from "@/lib/utils";
import { ButtonLink, Button } from "@/components/ui/Button";
import { Modal } from "@/components/admin/Modal";
import { OrderStatusTimeline } from "@/components/account/OrderStatusTimeline";
import type {
  ApiOrder,
  ApiRefund,
  ApiReturnRequest,
  OrderStatus,
  RefundReasonCategory,
  ReturnRequestType,
} from "@/types/api";

const REASON_CATEGORIES: RefundReasonCategory[] = [
  "damaged",
  "wrong_item",
  "not_as_described",
  "changed_mind",
  "other",
];

const REFUND_STATUS_LABEL: Record<ApiRefund["status"], string> = {
  pending_review: "Refund requested — pending review",
  pending_approval: "Refund pending financial approval",
  approved: "Refund approved",
  rejected: "Refund request rejected",
};

const RETURN_REQUEST_STATUS_LABEL: Record<ApiReturnRequest["status"], (type: ReturnRequestType) => string> = {
  pending: (type) => `${type === "return" ? "Return" : "Exchange"} requested — pending review`,
  approved: (type) => (type === "return" ? "Return approved" : "Exchange approved"),
  rejected: (type) => `${type === "return" ? "Return" : "Exchange"} request rejected`,
};

const fieldClasses =
  "w-full rounded border border-green-900/15 bg-cream-50 px-3 py-2 text-sm text-green-950 placeholder:text-brown-500/50 focus:border-green-900/40 focus:outline-none";
const labelClasses = "mb-1 block text-xs font-bold uppercase tracking-[0.06em] text-brown-600";

function refundOrderId(order: ApiRefund["order"]): string {
  return typeof order === "string" ? order : order._id;
}

function returnRequestOrderId(order: ApiReturnRequest["order"]): string {
  return typeof order === "string" ? order : order._id;
}

const STATUS_CLASSES: Record<OrderStatus, string> = {
  pending: "bg-cream-300 text-brown-600",
  confirmed: "bg-cream-300 text-brown-600",
  processing: "bg-gold-soft text-gold-700",
  packed: "bg-gold-soft text-gold-700",
  ready_for_dispatch: "bg-gold-soft text-gold-700",
  assigned_to_agent: "bg-success-soft text-green-900",
  picked_up: "bg-success-soft text-green-900",
  out_for_delivery: "bg-success-soft text-green-900",
  otp_verified: "bg-success-soft text-green-900",
  delivered: "bg-brand-deep-2 text-white",
  delivery_failed: "bg-danger-soft text-danger",
  cancelled: "bg-danger-soft text-danger",
  returned: "bg-danger-soft text-danger",
  refunded: "bg-danger-soft text-danger",
};

export function OrderHistory() {
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [refunds, setRefunds] = useState<ApiRefund[]>([]);
  const [returnRequests, setReturnRequests] = useState<ApiReturnRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [refundOrder, setRefundOrder] = useState<ApiOrder | null>(null);
  const [reasonCategory, setReasonCategory] = useState<RefundReasonCategory>("other");
  const [requestedAmountBDT, setRequestedAmountBDT] = useState("");
  const [note, setNote] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [returnOrder, setReturnOrder] = useState<ApiOrder | null>(null);
  const [returnType, setReturnType] = useState<ReturnRequestType>("return");
  const [returnReasonCategory, setReturnReasonCategory] = useState<RefundReasonCategory>("other");
  const [returnNote, setReturnNote] = useState("");
  const [desiredExchangeDetails, setDesiredExchangeDetails] = useState("");
  const [returnFormError, setReturnFormError] = useState<string | null>(null);
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);

  function loadRefunds() {
    listRefunds({ limit: 100 })
      .then(({ data }) => setRefunds(data.refunds))
      .catch(() => setRefunds([]));
  }

  function loadReturnRequests() {
    listReturnRequests({ limit: 100 })
      .then(({ data }) => setReturnRequests(data.requests))
      .catch(() => setReturnRequests([]));
  }

  useEffect(() => {
    let cancelled = false;
    listMyOrders(1, 50)
      .then(({ data }) => {
        if (!cancelled) setOrders(data.orders);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load your orders.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    loadRefunds();
    loadReturnRequests();
    return () => {
      cancelled = true;
    };
  }, []);

  function openRefundRequest(order: ApiOrder) {
    setFormError(null);
    setReasonCategory("other");
    setRequestedAmountBDT(String(order.totalBDT));
    setNote("");
    setRefundOrder(order);
  }

  async function handleRefundSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!refundOrder) return;
    setFormError(null);
    setIsSubmitting(true);
    try {
      await createRefund({
        orderId: refundOrder._id,
        reasonCategory,
        requestedAmountBDT: Number(requestedAmountBDT),
        note: note || undefined,
      });
      setRefundOrder(null);
      loadRefunds();
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.message : "Could not submit refund request.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function openReturnRequest(order: ApiOrder) {
    setReturnFormError(null);
    setReturnType("return");
    setReturnReasonCategory("other");
    setReturnNote("");
    setDesiredExchangeDetails("");
    setReturnOrder(order);
  }

  async function handleReturnSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!returnOrder) return;
    setReturnFormError(null);
    setIsSubmittingReturn(true);
    try {
      await createReturnRequest({
        orderId: returnOrder._id,
        type: returnType,
        reasonCategory: returnReasonCategory,
        note: returnNote || undefined,
        desiredExchangeDetails: returnType === "exchange" ? desiredExchangeDetails || undefined : undefined,
      });
      setReturnOrder(null);
      loadReturnRequests();
    } catch (err) {
      setReturnFormError(
        err instanceof ApiClientError ? err.message : "Could not submit the return/exchange request."
      );
    } finally {
      setIsSubmittingReturn(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-32 w-full animate-pulse rounded-xl bg-surface" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-dashed border-danger/30 bg-surface py-16 text-center text-sm text-danger">
        {error}
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-brown-500/30 bg-surface py-16 text-center">
        <Package size={32} className="text-brown-500/50" />
        <p className="text-sm text-brown-500">You haven&apos;t placed any orders yet.</p>
        <ButtonLink href="/shop" variant="primary" size="sm">
          Start Shopping
        </ButtonLink>
      </div>
    );
  }

  const CLOSED_STATUSES: OrderStatus[] = ["delivered", "cancelled", "returned", "refunded"];
  const pendingCount = orders.filter((o) => !CLOSED_STATUSES.includes(o.status)).length;
  const deliveredCount = orders.filter((o) => o.status === "delivered").length;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-3 gap-4">
        <SummaryTile label="Total Orders" value={orders.length} />
        <SummaryTile label="In Progress" value={pendingCount} />
        <SummaryTile label="Delivered" value={deliveredCount} />
      </div>

      <div className="flex flex-col gap-4">
        {orders.map((order) => (
          <div
            key={order._id}
            className="flex flex-col gap-4 rounded-xl border border-brown-600/10 bg-surface p-5 shadow-[0_1px_2px_rgba(61,43,31,0.04)] transition-shadow hover:shadow-md"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-green-950/5 text-green-900">
                  <Package size={17} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-green-950">#{order.orderNumber}</p>
                  <p className="text-xs text-brown-500">
                    {new Date(order.createdAt).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </div>
              <span
                className={cn(
                  "rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em]",
                  STATUS_CLASSES[order.status]
                )}
              >
                {order.status.replace(/_/g, " ")}
              </span>
            </div>

            <ul className="flex flex-col gap-1 border-y border-brown-600/10 py-3 text-sm text-brown-600">
              {order.items.map((item) => (
                <li key={`${item.product}-${item.variantId}`} className="flex items-center justify-between gap-3">
                  <span className="truncate">
                    {item.quantity}× {item.productName} ({item.variantLabel})
                  </span>
                  <span className="shrink-0 text-brown-500">{formatBDT(item.lineTotalBDT)}</span>
                </li>
              ))}
            </ul>

            <OrderStatusTimeline
              status={order.status}
              statusHistory={order.statusHistory}
              estimatedDeliveryDate={order.estimatedDeliveryDate}
            />

            {order.deliveryProofImage && (
              <div className="flex items-center gap-3 border-t border-brown-600/10 pt-3">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-brown-600">
                  <Camera size={13} /> Delivery photo proof:
                </span>
                <a href={order.deliveryProofImage.url} target="_blank" rel="noopener noreferrer">
                  <Image
                    src={order.deliveryProofImage.url}
                    alt="Delivery proof"
                    width={48}
                    height={48}
                    className="size-12 rounded object-cover"
                  />
                </a>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-4">
                <Link
                  href={`/track-order?orderNumber=${encodeURIComponent(order.orderNumber)}`}
                  className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.06em] text-green-900 hover:text-green-950"
                >
                  <Search size={12} /> Track Order
                </Link>
                <PrintInvoiceButton order={order} />
              </div>
              <span className="text-base font-semibold text-green-950">{formatBDT(order.totalBDT)}</span>
            </div>

            {order.status === "returned" &&
              (() => {
                const existingRefund = refunds.find((r) => refundOrderId(r.order) === order._id);
                if (existingRefund) {
                  return (
                    <p className="flex items-center gap-1.5 border-t border-brown-600/10 pt-3 text-xs font-semibold text-brown-600">
                      <Undo2 size={13} /> {REFUND_STATUS_LABEL[existingRefund.status]}
                    </p>
                  );
                }
                return (
                  <div className="border-t border-brown-600/10 pt-3">
                    <Button variant="outline" size="xs" onClick={() => openRefundRequest(order)}>
                      <Undo2 size={13} /> Request a Refund
                    </Button>
                  </div>
                );
              })()}

            {order.status === "delivered" &&
              (() => {
                const existingRequest = returnRequests.find((r) => returnRequestOrderId(r.order) === order._id);
                if (existingRequest) {
                  return (
                    <p className="flex items-center gap-1.5 border-t border-brown-600/10 pt-3 text-xs font-semibold text-brown-600">
                      <RefreshCcw size={13} />{" "}
                      {RETURN_REQUEST_STATUS_LABEL[existingRequest.status](existingRequest.type)}
                    </p>
                  );
                }
                return (
                  <div className="border-t border-brown-600/10 pt-3">
                    <Button variant="outline" size="xs" onClick={() => openReturnRequest(order)}>
                      <RefreshCcw size={13} /> Return / Exchange
                    </Button>
                  </div>
                );
              })()}
          </div>
        ))}
      </div>

      {refundOrder && (
        <Modal title={`Request a Refund — #${refundOrder.orderNumber}`} onClose={() => setRefundOrder(null)}>
          <form onSubmit={handleRefundSubmit} className="flex flex-col gap-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClasses}>Reason *</label>
                <select
                  value={reasonCategory}
                  onChange={(e) => setReasonCategory(e.target.value as RefundReasonCategory)}
                  className={fieldClasses}
                >
                  {REASON_CATEGORIES.map((r) => (
                    <option key={r} value={r}>
                      {r.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClasses}>Amount (BDT) *</label>
                <input
                  required
                  type="number"
                  min={0}
                  max={refundOrder.totalBDT}
                  value={requestedAmountBDT}
                  onChange={(e) => setRequestedAmountBDT(e.target.value)}
                  className={fieldClasses}
                />
              </div>
            </div>
            <div>
              <label className={labelClasses}>Note</label>
              <textarea
                rows={3}
                placeholder="Tell us more about the issue (optional)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className={fieldClasses}
              />
            </div>

            {formError && <p className="text-sm text-danger">{formError}</p>}

            <div className="flex justify-end gap-3 border-t border-brown-600/10 pt-4">
              <Button type="button" variant="outline" size="sm" onClick={() => setRefundOrder(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" disabled={isSubmitting}>
                {isSubmitting ? "Submitting..." : "Submit Request"}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {returnOrder && (
        <Modal title={`Return / Exchange — #${returnOrder.orderNumber}`} onClose={() => setReturnOrder(null)}>
          <form onSubmit={handleReturnSubmit} className="flex flex-col gap-5">
            <div>
              <label className={labelClasses}>Request Type *</label>
              <div className="flex gap-3">
                {(["return", "exchange"] as ReturnRequestType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setReturnType(t)}
                    className={cn(
                      "flex-1 cursor-pointer rounded border px-3 py-2 text-sm font-semibold capitalize transition-colors",
                      returnType === t
                        ? "border-green-900 bg-green-950/5 text-green-950"
                        : "border-green-900/15 text-brown-600 hover:border-green-900/30"
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClasses}>Reason *</label>
                <select
                  value={returnReasonCategory}
                  onChange={(e) => setReturnReasonCategory(e.target.value as RefundReasonCategory)}
                  className={fieldClasses}
                >
                  {REASON_CATEGORIES.map((r) => (
                    <option key={r} value={r}>
                      {r.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {returnType === "exchange" && (
              <div>
                <label className={labelClasses}>What would you like instead? *</label>
                <textarea
                  required
                  rows={2}
                  placeholder="e.g. Swap for the 1kg size"
                  value={desiredExchangeDetails}
                  onChange={(e) => setDesiredExchangeDetails(e.target.value)}
                  className={fieldClasses}
                />
              </div>
            )}
            <div>
              <label className={labelClasses}>Note</label>
              <textarea
                rows={3}
                placeholder="Tell us more about the issue (optional)"
                value={returnNote}
                onChange={(e) => setReturnNote(e.target.value)}
                className={fieldClasses}
              />
            </div>

            {returnFormError && <p className="text-sm text-danger">{returnFormError}</p>}

            <div className="flex justify-end gap-3 border-t border-brown-600/10 pt-4">
              <Button type="button" variant="outline" size="sm" onClick={() => setReturnOrder(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" disabled={isSubmittingReturn}>
                {isSubmittingReturn ? "Submitting..." : "Submit Request"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-brown-600/10 bg-surface p-4 text-center">
      <span className="block text-xl font-semibold text-green-950">{value}</span>
      <span className="block text-[11px] font-bold uppercase tracking-wide text-brown-500">{label}</span>
    </div>
  );
}
