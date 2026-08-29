"use client";

import { useEffect, useState } from "react";
import { Plus, Undo2 } from "lucide-react";
import { approveRefund, createRefund, listRefunds, rejectRefund, reviewRefund } from "@/lib/api/finance";
import { listOrders } from "@/lib/api/orders";
import { ApiClientError } from "@/lib/api/client";
import { useAuth } from "@/context/AuthContext";
import { useConfirm } from "@/context/ConfirmDialogContext";
import { formatBDT } from "@/lib/utils";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState, TableSkeleton, ErrorState } from "@/components/admin/EmptyState";
import { Modal } from "@/components/admin/Modal";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { Button } from "@/components/ui/Button";
import type { ApiOrder, ApiRefund, Pagination, RefundReasonCategory } from "@/types/api";

const REASON_CATEGORIES: RefundReasonCategory[] = [
  "damaged",
  "wrong_item",
  "not_as_described",
  "changed_mind",
  "other",
];

const fieldClasses =
  "w-full rounded border border-green-900/15 bg-cream-50 px-3 py-2 text-sm text-green-950 placeholder:text-brown-500/50 focus:border-green-900/40 focus:outline-none";
const labelClasses = "mb-1 block text-xs font-bold uppercase tracking-[0.06em] text-brown-600";

function personName(person: ApiRefund["requestedBy"]): string {
  return typeof person === "string" ? person : person.name;
}

function orderLabel(order: ApiRefund["order"]): string {
  return typeof order === "string" ? order : `#${order.orderNumber}`;
}

export default function AdminRefundsPage() {
  const { user } = useAuth();
  const confirmDialog = useConfirm();
  const canReview = user?.role === "order_manager" || user?.role === "admin" || user?.role === "super_admin";
  const canApprove = user?.role === "admin" || user?.role === "super_admin";

  const [refunds, setRefunds] = useState<ApiRefund[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [pendingNotice, setPendingNotice] = useState<string | null>(null);

  const [isAdding, setIsAdding] = useState(false);
  const [returnedOrders, setReturnedOrders] = useState<ApiOrder[]>([]);
  const [orderId, setOrderId] = useState("");
  const [reasonCategory, setReasonCategory] = useState<RefundReasonCategory>("other");
  const [requestedAmountBDT, setRequestedAmountBDT] = useState("");
  const [note, setNote] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function load() {
    setIsLoading(true);
    listRefunds({ page, limit: 20 })
      .then(({ data, pagination: pg }) => {
        setRefunds(data.refunds);
        setPagination(pg ?? null);
        setError(null);
      })
      .catch(() => setError("Could not load refund requests."))
      .finally(() => setIsLoading(false));
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(load, [page]);

  function openNewRequest() {
    setFormError(null);
    setIsAdding(true);
    listOrders({ status: "returned", limit: 50 })
      .then(({ data }) => setReturnedOrders(data.orders))
      .catch(() => setReturnedOrders([]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!orderId) {
      setFormError("Select an order.");
      return;
    }
    setFormError(null);
    setIsSubmitting(true);
    try {
      const { data } = await createRefund({
        orderId,
        reasonCategory,
        requestedAmountBDT: Number(requestedAmountBDT),
        note: note || undefined,
      });
      if (data.pendingActionId) {
        setPendingNotice("This request requires Super Admin approval — submitted for review.");
      }
      setIsAdding(false);
      setOrderId("");
      setRequestedAmountBDT("");
      setNote("");
      load();
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.message : "Could not submit refund request.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleReview(refund: ApiRefund, decision: "approve" | "reject") {
    const ok = await confirmDialog({
      title: decision === "approve" ? "Recommend Refund" : "Reject Refund Request",
      message:
        decision === "approve"
          ? `Recommend the ${formatBDT(refund.requestedAmountBDT)} refund on order ${orderLabel(refund.order)} for financial approval?`
          : `Reject the refund request on order ${orderLabel(refund.order)}? The requester will be notified.`,
      confirmLabel: decision === "approve" ? "Recommend" : "Reject",
      tone: decision === "approve" ? "primary" : "danger",
    });
    if (!ok) return;
    setActionError(null);
    setActingId(refund._id);
    try {
      await reviewRefund(refund._id, decision);
      load();
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.message : "Could not review refund request.");
    } finally {
      setActingId(null);
    }
  }

  async function handleReject(refund: ApiRefund) {
    const ok = await confirmDialog({
      title: "Reject Refund",
      message: `Reject the ${formatBDT(refund.requestedAmountBDT)} refund on order ${orderLabel(refund.order)}? This closes the request.`,
      confirmLabel: "Reject",
      tone: "danger",
    });
    if (!ok) return;
    const reason = prompt("Reason for rejecting (optional):");
    // `prompt()` returns null only when the user cancels — an empty string
    // means they clicked OK with no text entered, which should still reject.
    // Treating both the same way used to reject the refund even on Cancel.
    if (reason === null) return;
    setActionError(null);
    setActingId(refund._id);
    try {
      await rejectRefund(refund._id, reason || undefined);
      load();
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.message : "Could not reject refund request.");
    } finally {
      setActingId(null);
    }
  }

  async function handleApprove(refund: ApiRefund) {
    const ok = await confirmDialog({
      title: "Approve Refund",
      message: `Financially approve a ${formatBDT(refund.requestedAmountBDT)} refund on order ${orderLabel(refund.order)}? Depending on the approval threshold this either takes effect immediately or goes to Super Admin for review.`,
      confirmLabel: "Approve Refund",
    });
    if (!ok) return;
    setActionError(null);
    setActingId(refund._id);
    try {
      const { data } = await approveRefund(refund._id);
      if (data.pendingActionId) {
        setPendingNotice("This refund amount requires Super Admin approval — submitted for review.");
      }
      load();
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.message : "Could not approve refund.");
    } finally {
      setActingId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Refunds"
        description="Order Manager reviews, then Admin/Super Admin financially approves."
        action={
          <Button variant="primary" size="sm" onClick={openNewRequest}>
            <Plus size={14} /> New Refund Request
          </Button>
        }
      />

      {pendingNotice && (
        <div className="mb-4 rounded-lg border border-gold-500/40 bg-gold-soft p-4 text-sm text-gold-700">
          {pendingNotice}
        </div>
      )}
      {actionError && <p className="mb-4 text-sm text-danger">{actionError}</p>}

      {isLoading ? (
        <TableSkeleton />
      ) : error ? (
        <ErrorState message={error} />
      ) : refunds.length === 0 ? (
        <EmptyState icon={Undo2} title="No refund requests" description="Refund requests will show up here." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-brown-600/10 bg-surface">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-brown-600/10 text-xs uppercase tracking-wide text-brown-500">
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Requested By</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {refunds.map((refund) => (
                <tr key={refund._id} className="border-b border-brown-600/10 last:border-none">
                  <td className="px-4 py-3 font-medium text-green-950">{orderLabel(refund.order)}</td>
                  <td className="px-4 py-3 capitalize text-brown-600">{refund.reasonCategory.replace(/_/g, " ")}</td>
                  <td className="px-4 py-3 text-brown-600">{formatBDT(refund.requestedAmountBDT)}</td>
                  <td className="px-4 py-3 text-brown-600">{personName(refund.requestedBy)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={refund.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      {canReview && refund.status === "pending_review" && (
                        <>
                          <Button
                            variant="primary"
                            size="xs"
                            disabled={actingId === refund._id}
                            onClick={() => handleReview(refund, "approve")}
                          >
                            Review OK
                          </Button>
                          <Button
                            variant="danger"
                            size="xs"
                            disabled={actingId === refund._id}
                            onClick={() => handleReject(refund)}
                          >
                            Reject
                          </Button>
                        </>
                      )}
                      {canApprove && refund.status === "pending_approval" && (
                        <>
                          <Button
                            variant="primary"
                            size="xs"
                            disabled={actingId === refund._id}
                            onClick={() => handleApprove(refund)}
                          >
                            Approve
                          </Button>
                          <Button
                            variant="danger"
                            size="xs"
                            disabled={actingId === refund._id}
                            onClick={() => handleReject(refund)}
                          >
                            Reject
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 pb-4">
            <AdminPagination pagination={pagination} onPageChange={setPage} />
          </div>
        </div>
      )}

      {isAdding && (
        <Modal title="New Refund Request" onClose={() => setIsAdding(false)}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div>
              <label className={labelClasses}>Order (must be &quot;returned&quot;) *</label>
              <select required value={orderId} onChange={(e) => setOrderId(e.target.value)} className={fieldClasses}>
                <option value="">Select an order</option>
                {returnedOrders.map((order) => (
                  <option key={order._id} value={order._id}>
                    #{order.orderNumber} — {formatBDT(order.totalBDT)}
                  </option>
                ))}
              </select>
              {returnedOrders.length === 0 && (
                <p className="mt-1 text-xs text-brown-500">No orders currently marked &quot;returned&quot;.</p>
              )}
            </div>
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
                  value={requestedAmountBDT}
                  onChange={(e) => setRequestedAmountBDT(e.target.value)}
                  className={fieldClasses}
                />
              </div>
            </div>
            <div>
              <label className={labelClasses}>{reasonCategory === "other" ? "Please specify *" : "Note"}</label>
              <textarea
                required={reasonCategory === "other"}
                rows={3}
                placeholder={reasonCategory === "other" ? "Tell us the reason for this refund" : undefined}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className={fieldClasses}
              />
            </div>

            {formError && <p className="text-sm text-danger">{formError}</p>}

            <div className="flex justify-end gap-3 border-t border-brown-600/10 pt-4">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsAdding(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" disabled={isSubmitting}>
                {isSubmitting ? "Submitting..." : "Submit Request"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
