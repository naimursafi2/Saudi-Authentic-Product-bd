"use client";

import { useEffect, useState } from "react";
import { CreditCard, TriangleAlert } from "lucide-react";
import { getGatewayStatus, listPayments } from "@/lib/api/payments";
import { formatBDT } from "@/lib/utils";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState, TableSkeleton, ErrorState } from "@/components/admin/EmptyState";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { AdminPagination } from "@/components/admin/AdminPagination";
import type { ApiPayment, Pagination, PaymentStatus } from "@/types/api";

const STATUS_OPTIONS: PaymentStatus[] = [
  "initiated",
  "pending",
  "paid",
  "failed",
  "cancelled",
  "refunded",
];

function customerName(customer: ApiPayment["customer"]): string {
  return typeof customer === "string" ? customer : customer.name;
}

function orderNumber(payment: ApiPayment): string {
  return typeof payment.order === "string" ? payment.merchantInvoiceNumber : payment.order.orderNumber;
}

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<ApiPayment[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | "">("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gateway, setGateway] = useState<{
    configured: boolean;
    missingKeys: string[];
    mode: "sandbox" | "live";
  } | null>(null);

  useEffect(() => {
    getGatewayStatus()
      .then(({ data }) => setGateway(data.sslcommerz))
      .catch(() => setGateway(null));
  }, []);

  function load() {
    setIsLoading(true);
    listPayments({ status: statusFilter || undefined, page, limit: 20 })
      .then(({ data, pagination: pg }) => {
        setPayments(data.payments);
        setPagination(pg ?? null);
        setError(null);
      })
      .catch(() => setError("Could not load payments."))
      .finally(() => setIsLoading(false));
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(load, [page, statusFilter]);

  return (
    <div>
      <PageHeader
        title="Payments"
        description="SSLCommerz online payments, read-only. Every status here is verified with SSLCommerz itself — verification is automatic, so there is nothing to confirm by hand."
      />

      {gateway?.configured && gateway.mode === "sandbox" && (
        <div className="mb-4 flex gap-3 rounded-lg border border-info/30 bg-info-soft p-4">
          <TriangleAlert size={18} className="mt-0.5 shrink-0 text-info" />
          <p className="text-sm text-info">
            SSLCommerz is running in <span className="font-semibold">sandbox (test) mode</span> — no real
            money is collected. Set <span className="font-mono text-xs">SSLCOMMERZ_IS_LIVE=true</span> in
            the server&apos;s <span className="font-mono text-xs">.env</span> once your store is approved for
            live payments.
          </p>
        </div>
      )}

      {gateway && !gateway.configured && (
        <div className="mb-4 flex gap-3 rounded-lg border border-gold-500/40 bg-gold-soft p-4">
          <TriangleAlert size={18} className="mt-0.5 shrink-0 text-gold-700" />
          <div className="text-sm text-gold-700">
            <p className="font-semibold">SSLCommerz is not configured, so online payment is unavailable at checkout.</p>
            <p className="mt-1">
              Customers can currently only use Cash on Delivery. To switch online payment on, set{" "}
              {gateway.missingKeys.length === 0
                ? "the SSLCommerz credentials"
                : gateway.missingKeys.join(", ")}{" "}
              in the server&apos;s <span className="font-mono text-xs">.env</span> file and restart the
              API. The values come from your SSLCommerz merchant panel.
            </p>
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as PaymentStatus | "");
            setPage(1);
          }}
          className="h-9 rounded border border-brown-600/20 bg-surface px-3 text-sm text-green-950 focus:outline-none focus:ring-1 focus:ring-green-900/30"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <TableSkeleton />
      ) : error ? (
        <ErrorState message={error} />
      ) : payments.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="No payments yet"
          description="Online payments will show up here as customers pay for their orders."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-brown-600/10 bg-surface">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-brown-600/10 text-xs uppercase tracking-wide text-brown-500">
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Transaction ID</th>
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment._id} className="border-b border-brown-600/10 last:border-none">
                  <td className="px-4 py-3 font-medium text-green-950">{orderNumber(payment)}</td>
                  <td className="px-4 py-3 text-brown-600">{customerName(payment.customer)}</td>
                  <td className="px-4 py-3 text-brown-600">SSLCommerz</td>
                  <td className="px-4 py-3 text-brown-600">{formatBDT(payment.amountBDT)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={payment.status} />
                    {payment.failureReason && (
                      <span className="mt-1 block max-w-[220px] text-xs text-brown-500">
                        {payment.failureReason}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-brown-600">
                    {payment.transactionId ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-brown-600">
                    {new Date(payment.paidAt ?? payment.createdAt).toLocaleDateString()}
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
