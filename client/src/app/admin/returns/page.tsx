"use client";

import { useEffect, useState } from "react";
import { RefreshCcw } from "lucide-react";
import { listReturnRequests, reviewReturnRequest } from "@/lib/api/returns";
import { ApiClientError } from "@/lib/api/client";
import { useConfirm } from "@/context/ConfirmDialogContext";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState, TableSkeleton, ErrorState } from "@/components/admin/EmptyState";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { Button } from "@/components/ui/Button";
import type { ApiReturnRequest, Pagination } from "@/types/api";

function personName(person: ApiReturnRequest["customer"]): string {
  return typeof person === "string" ? person : person.name;
}

function orderLabel(order: ApiReturnRequest["order"]): string {
  return typeof order === "string" ? order : `#${order.orderNumber}`;
}

export default function AdminReturnsPage() {
  const confirmDialog = useConfirm();
  const [requests, setRequests] = useState<ApiReturnRequest[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  function load() {
    setIsLoading(true);
    listReturnRequests({ page, limit: 20 })
      .then(({ data, pagination: pg }) => {
        setRequests(data.requests);
        setPagination(pg ?? null);
        setError(null);
      })
      .catch(() => setError("Could not load return/exchange requests."))
      .finally(() => setIsLoading(false));
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(load, [page]);

  async function handleApprove(request: ApiReturnRequest) {
    const ok = await confirmDialog({
      title: request.type === "exchange" ? "Approve Exchange" : "Approve Return",
      message:
        request.type === "exchange"
          ? `Approve the exchange on order ${orderLabel(request.order)}? There is no automated replacement-order flow — approving commits you to handling the swap manually.`
          : `Approve the return on order ${orderLabel(request.order)}? This moves the order to "returned", restocks its items and unlocks a refund request.`,
      confirmLabel: "Approve",
    });
    if (!ok) return;
    setActionError(null);
    setActingId(request._id);
    try {
      await reviewReturnRequest(request._id, "approve");
      load();
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.message : "Could not approve this request.");
    } finally {
      setActingId(null);
    }
  }

  async function handleReject(request: ApiReturnRequest) {
    const ok = await confirmDialog({
      title: "Reject Request",
      message: `Reject ${personName(request.customer)}'s ${request.type} request on order ${orderLabel(request.order)}? The customer will be notified.`,
      confirmLabel: "Reject",
      tone: "danger",
    });
    if (!ok) return;
    const reason = prompt("Reason for rejecting (optional):");
    // `prompt()` returns null only on Cancel — an empty string means OK with
    // no text, which should still reject (see CLAUDE.md's note on this).
    if (reason === null) return;
    setActionError(null);
    setActingId(request._id);
    try {
      await reviewReturnRequest(request._id, "reject", reason || undefined);
      load();
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.message : "Could not reject this request.");
    } finally {
      setActingId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Return & Exchange Requests"
        description="Customer-initiated return/exchange requests. Approving a return moves the order to 'returned', unlocking a refund request. Approving an exchange is a commitment to handle the swap manually — there is no automated replacement-order flow."
      />

      {actionError && <p className="mb-4 text-sm text-danger">{actionError}</p>}

      {isLoading ? (
        <TableSkeleton />
      ) : error ? (
        <ErrorState message={error} />
      ) : requests.length === 0 ? (
        <EmptyState
          icon={RefreshCcw}
          title="No return/exchange requests"
          description="Customer return and exchange requests will show up here."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-brown-600/10 bg-surface">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-brown-600/10 text-xs uppercase tracking-wide text-brown-500">
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Note</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {requests.map((req) => (
                <tr key={req._id} className="border-b border-brown-600/10 last:border-none">
                  <td className="px-4 py-3 font-medium text-green-950">{orderLabel(req.order)}</td>
                  <td className="px-4 py-3 capitalize text-brown-600">{req.type}</td>
                  <td className="px-4 py-3 capitalize text-brown-600">{req.reasonCategory.replace(/_/g, " ")}</td>
                  <td className="px-4 py-3 text-brown-600">{personName(req.customer)}</td>
                  <td className="max-w-[220px] truncate px-4 py-3 text-brown-600" title={req.note}>
                    {req.type === "exchange" ? req.desiredExchangeDetails : req.note ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={req.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {req.status === "pending" && (
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="primary"
                          size="xs"
                          disabled={actingId === req._id}
                          onClick={() => handleApprove(req)}
                        >
                          Approve
                        </Button>
                        <Button
                          variant="danger"
                          size="xs"
                          disabled={actingId === req._id}
                          onClick={() => handleReject(req)}
                        >
                          Reject
                        </Button>
                      </div>
                    )}
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
    </div>
  );
}
