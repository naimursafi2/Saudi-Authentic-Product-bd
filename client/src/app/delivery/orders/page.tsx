"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Camera, PackageSearch } from "lucide-react";
import {
  listAssignedOrders,
  getOrder,
  updateDeliveryStatus,
  sendDeliveryOtp,
  verifyDeliveryOtp,
  markDeliveryFailed,
} from "@/lib/api/orders";
import { ApiClientError } from "@/lib/api/client";
import { formatBDT } from "@/lib/utils";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState, TableSkeleton, ErrorState } from "@/components/admin/EmptyState";
import { Modal } from "@/components/admin/Modal";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Button } from "@/components/ui/Button";
import type { ApiOrder, Pagination } from "@/types/api";

const DELIVERY_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "assigned_to_agent", label: "assigned to agent" },
  { value: "picked_up,out_for_delivery", label: "in transit" },
  { value: "delivered", label: "delivered" },
  { value: "delivery_failed", label: "delivery failed" },
  { value: "returned", label: "returned" },
];

function customerName(customer: ApiOrder["customer"]): string {
  return typeof customer === "string" ? customer : customer.name;
}

export default function DeliveryOrdersPage() {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <DeliveryOrdersPageContent />
    </Suspense>
  );
}

function DeliveryOrdersPageContent() {
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") ?? "");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);

  function load() {
    setIsLoading(true);
    listAssignedOrders(page, 20, statusFilter || undefined)
      .then(({ data, pagination: pg }) => {
        setOrders(data.orders);
        setPagination(pg ?? null);
        setError(null);
      })
      .catch(() => setError("Could not load your assigned orders."))
      .finally(() => setIsLoading(false));
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(load, [page, statusFilter]);

  return (
    <div>
      <PageHeader title="Assigned Orders" description="Orders assigned to you for delivery." />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="h-9 rounded border border-brown-600/20 bg-surface px-3 text-sm text-green-950 focus:outline-none focus:ring-1 focus:ring-green-900/30"
        >
          <option value="">All statuses</option>
          {DELIVERY_STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <TableSkeleton />
      ) : error ? (
        <ErrorState message={error} />
      ) : orders.length === 0 ? (
        <EmptyState
          icon={PackageSearch}
          title="No orders assigned yet"
          description="Orders assigned to you for delivery will show up here."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-brown-600/10 bg-surface">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-brown-600/10 text-xs uppercase tracking-wide text-brown-500">
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Address</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order._id} className="border-b border-brown-600/10 last:border-none">
                  <td className="px-4 py-3 font-medium text-green-950">{order.orderNumber}</td>
                  <td className="px-4 py-3 text-brown-600">{customerName(order.customer)}</td>
                  <td className="px-4 py-3 text-brown-600">
                    {order.shippingAddress.cityArea}, {order.shippingAddress.district}
                  </td>
                  <td className="px-4 py-3 text-brown-600">{formatBDT(order.totalBDT)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={order.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="outline" size="sm" onClick={() => setViewingId(order._id)}>
                      View
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AdminPagination pagination={pagination} onPageChange={setPage} />

      {viewingId && (
        <DeliveryOrderModal orderId={viewingId} onClose={() => setViewingId(null)} onUpdated={load} />
      )}
    </div>
  );
}

function DeliveryOrderModal({
  orderId,
  onClose,
  onUpdated,
}: {
  orderId: string;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [order, setOrder] = useState<ApiOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isActing, setIsActing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [proofImage, setProofImage] = useState<File | null>(null);
  const [failureReason, setFailureReason] = useState("");
  const [note, setNote] = useState("");
  const [showFailureForm, setShowFailureForm] = useState(false);

  function loadOrder() {
    setIsLoading(true);
    getOrder(orderId)
      .then(({ data }) => {
        setOrder(data.order);
        setError(null);
      })
      .catch(() => setError("Could not load order details."))
      .finally(() => setIsLoading(false));
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(loadOrder, [orderId]);

  // Whether an OTP is currently outstanding for this order. Actual expiry is
  // still enforced server-side on verify — if a shown code has gone stale,
  // "Verify" simply fails with a clear error and "Resend OTP" is right there.
  const otpActive = Boolean(order?.otpExpiresAt);

  async function handlePickedUp() {
    if (!order) return;
    setActionError(null);
    setIsActing(true);
    try {
      const { data } = await updateDeliveryStatus(order._id, "picked_up", note || undefined);
      setOrder(data.order);
      setNote("");
      onUpdated();
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.message : "Could not update status.");
    } finally {
      setIsActing(false);
    }
  }

  async function handleOutForDelivery() {
    if (!order) return;
    setActionError(null);
    setIsActing(true);
    try {
      const { data } = await updateDeliveryStatus(order._id, "out_for_delivery", note || undefined);
      setOrder(data.order);
      setNote("");
      onUpdated();
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.message : "Could not update status.");
    } finally {
      setIsActing(false);
    }
  }

  async function handleSendOtp() {
    if (!order) return;
    setActionError(null);
    setIsActing(true);
    try {
      const { data } = await sendDeliveryOtp(order._id);
      setOrder(data.order);
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.message : "Could not send the delivery OTP.");
    } finally {
      setIsActing(false);
    }
  }

  async function handleVerifyOtp() {
    if (!order || !otp.trim()) return;
    setActionError(null);
    setIsActing(true);
    try {
      const { data } = await verifyDeliveryOtp(order._id, otp.trim(), note || undefined, proofImage ?? undefined);
      setOrder(data.order);
      setOtp("");
      setNote("");
      setProofImage(null);
      onUpdated();
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.message : "Could not verify OTP.");
    } finally {
      setIsActing(false);
    }
  }

  async function handleMarkFailed() {
    if (!order || !failureReason.trim()) return;
    setActionError(null);
    setIsActing(true);
    try {
      const { data } = await markDeliveryFailed(order._id, failureReason.trim(), note || undefined);
      setOrder(data.order);
      setFailureReason("");
      setNote("");
      setShowFailureForm(false);
      onUpdated();
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.message : "Could not mark delivery as failed.");
    } finally {
      setIsActing(false);
    }
  }

  return (
    <Modal title={order ? `Order ${order.orderNumber}` : "Order"} onClose={onClose} wide>
      {isLoading ? (
        <TableSkeleton rows={4} />
      ) : error || !order ? (
        <ErrorState message={error ?? "Order not found."} />
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-brown-500">Placed</p>
              <p className="text-sm text-green-950">{new Date(order.createdAt).toLocaleString()}</p>
            </div>
            <StatusBadge status={order.status} />
          </div>

          <section>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-brown-500">Delivery Address</h3>
            <div className="rounded-lg border border-brown-600/10 bg-cream-50 p-4 text-sm text-green-950">
              <p className="font-medium">
                {order.shippingAddress.firstName} {order.shippingAddress.lastName}
              </p>
              <p className="text-brown-600">{order.shippingAddress.fullAddress}</p>
              <p className="text-brown-600">
                {order.shippingAddress.cityArea}, {order.shippingAddress.district}
              </p>
              <p className="text-brown-600">{order.shippingAddress.phone}</p>
              <p className="mt-2 text-xs uppercase tracking-wide text-brown-500">
                {order.paymentMethod} &middot; {order.isPaid ? "Paid" : "Unpaid"} &middot;{" "}
                {formatBDT(order.totalBDT)}
              </p>
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-brown-500">
              Items ({order.items.length})
            </h3>
            <ul className="flex flex-col divide-y divide-brown-600/10 rounded-lg border border-brown-600/10">
              {order.items.map((item, i) => (
                <li key={i} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span>
                    {item.quantity}&times; {item.productName} ({item.variantLabel})
                  </span>
                  <span className="text-brown-500">{formatBDT(item.lineTotalBDT)}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-brown-500">Delivery Actions</h3>
            {actionError && <p className="mb-2 text-sm text-danger">{actionError}</p>}

            {order.status === "assigned_to_agent" && (
              <div className="flex flex-col gap-2">
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Note (optional)"
                  className="h-9 rounded border border-brown-600/20 bg-surface px-3 text-sm text-green-950 placeholder:text-brown-500/60 focus:outline-none focus:ring-1 focus:ring-green-900/30"
                />
                <Button variant="primary" size="sm" disabled={isActing} onClick={handlePickedUp}>
                  {isActing ? "Updating..." : "Mark as Picked Up"}
                </Button>
              </div>
            )}

            {order.status === "picked_up" && (
              <div className="flex flex-col gap-2">
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Note (optional)"
                  className="h-9 rounded border border-brown-600/20 bg-surface px-3 text-sm text-green-950 placeholder:text-brown-500/60 focus:outline-none focus:ring-1 focus:ring-green-900/30"
                />
                <Button variant="primary" size="sm" disabled={isActing} onClick={handleOutForDelivery}>
                  {isActing ? "Updating..." : "Mark as Out for Delivery"}
                </Button>
              </div>
            )}

            {order.status === "out_for_delivery" && (
              <div className="flex flex-col gap-4">
                {!otpActive ? (
                  <div className="rounded-lg border border-gold-500/40 bg-gold-soft p-4">
                    <p className="mb-2 text-sm text-gold-700">
                      Once you&apos;ve reached the customer, send them a delivery verification OTP.
                    </p>
                    <Button variant="primary" size="sm" disabled={isActing} onClick={handleSendOtp}>
                      {isActing ? "Sending..." : "Send Delivery OTP"}
                    </Button>
                  </div>
                ) : (
                  <div className="rounded-lg border border-gold-500/40 bg-gold-soft p-4">
                    <p className="mb-2 text-sm text-gold-700">
                      Ask the customer for their delivery verification code and enter it below to confirm receipt.
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                        placeholder="4-digit code"
                        inputMode="numeric"
                        maxLength={4}
                        className="h-9 w-32 rounded border border-brown-600/20 bg-surface px-3 text-sm text-green-950 placeholder:text-brown-500/60 focus:outline-none focus:ring-1 focus:ring-green-900/30"
                      />
                      <label className="flex h-9 cursor-pointer items-center gap-1.5 rounded border border-brown-600/20 bg-surface px-3 text-xs font-semibold text-brown-600 hover:border-green-900/30">
                        <Camera size={14} />
                        {proofImage ? proofImage.name : "Add photo proof (optional)"}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => setProofImage(e.target.files?.[0] ?? null)}
                        />
                      </label>
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={isActing || otp.trim().length !== 4}
                        onClick={handleVerifyOtp}
                      >
                        {isActing ? "Verifying..." : "Verify & Confirm Delivery"}
                      </Button>
                    </div>
                    <button
                      type="button"
                      disabled={isActing}
                      onClick={handleSendOtp}
                      className="mt-2 cursor-pointer text-xs font-bold uppercase tracking-[0.06em] text-green-900 hover:text-green-950 disabled:opacity-50"
                    >
                      Resend OTP
                    </button>
                  </div>
                )}

                {!showFailureForm ? (
                  <button
                    type="button"
                    onClick={() => setShowFailureForm(true)}
                    className="cursor-pointer self-start text-xs font-bold uppercase tracking-[0.06em] text-danger hover:underline"
                  >
                    Delivery failed instead?
                  </button>
                ) : (
                  <div className="flex flex-col gap-2 rounded-lg border border-danger-border bg-danger-soft p-4">
                    <input
                      required
                      value={failureReason}
                      onChange={(e) => setFailureReason(e.target.value)}
                      placeholder="Reason for failure (required)"
                      className="h-9 rounded border border-brown-600/20 bg-surface px-3 text-sm text-green-950 placeholder:text-brown-500/60 focus:outline-none focus:ring-1 focus:ring-green-900/30"
                    />
                    <input
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Delivery note (optional)"
                      className="h-9 rounded border border-brown-600/20 bg-surface px-3 text-sm text-green-950 placeholder:text-brown-500/60 focus:outline-none focus:ring-1 focus:ring-green-900/30"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isActing || !failureReason.trim()}
                      onClick={handleMarkFailed}
                    >
                      {isActing ? "Saving..." : "Mark Delivery Failed"}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {!["assigned_to_agent", "picked_up", "out_for_delivery"].includes(order.status) && (
              <p className="text-sm text-brown-500">No further delivery actions are available for this order.</p>
            )}
          </section>

          {order.statusHistory.length > 0 && (
            <section>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-brown-500">Status History</h3>
              <ul className="flex flex-col gap-2">
                {[...order.statusHistory].reverse().map((entry, i) => (
                  <li key={i} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <StatusBadge status={entry.status} />
                      {entry.note && <span className="text-xs text-brown-500">{entry.note}</span>}
                    </span>
                    <span className="text-xs text-brown-500">{new Date(entry.at).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </Modal>
  );
}
