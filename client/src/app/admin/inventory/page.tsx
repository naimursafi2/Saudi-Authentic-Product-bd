"use client";

import { useEffect, useState } from "react";
import { Plus, Boxes } from "lucide-react";
import { adjustStock, listInventoryLogs, listLowStockProducts } from "@/lib/api/inventory";
import { listProducts } from "@/lib/api/products";
import { ApiClientError } from "@/lib/api/client";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState, TableSkeleton, ErrorState } from "@/components/admin/EmptyState";
import { Modal } from "@/components/admin/Modal";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { Button } from "@/components/ui/Button";
import { InventoryAdjustForm, type InventoryAdjustFormResult } from "@/components/admin/InventoryAdjustForm";
import type { ApiInventoryLog, InventoryLogReason, LowStockEntry } from "@/types/hr";
import type { ApiProduct, Pagination } from "@/types/api";

const REASON_LABELS: Record<InventoryLogReason, string> = {
  order_placed: "Order Placed",
  order_cancelled: "Order Cancelled",
  manual_adjustment: "Manual Adjustment",
};

function refName(ref: string | { name: string }): string {
  return typeof ref === "string" ? ref : ref.name;
}

export default function AdminInventoryPage() {
  const [lowStock, setLowStock] = useState<LowStockEntry[]>([]);
  const [isLowStockLoading, setIsLowStockLoading] = useState(true);

  const [logs, setLogs] = useState<ApiInventoryLog[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingNotice, setPendingNotice] = useState<string | null>(null);

  function loadLowStock() {
    setIsLowStockLoading(true);
    listLowStockProducts()
      .then(({ data }) => setLowStock(data.products))
      .catch(() => {})
      .finally(() => setIsLowStockLoading(false));
  }

  function loadLogs() {
    setIsLoading(true);
    listInventoryLogs({ page, limit: 30 })
      .then(({ data, pagination: pg }) => {
        setLogs(data.logs);
        setPagination(pg ?? null);
        setError(null);
      })
      .catch(() => setError("Could not load inventory logs."))
      .finally(() => setIsLoading(false));
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(loadLogs, [page]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(loadLowStock, []);

  useEffect(() => {
    listProducts({ limit: 100 })
      .then(({ data }) => setProducts(data.products))
      .catch(() => {});
  }, []);

  async function handleAdjust(values: InventoryAdjustFormResult) {
    setFormError(null);
    setIsSubmitting(true);
    try {
      const { data } = await adjustStock({
        productId: values.productId,
        variantId: values.variantId,
        delta: values.delta,
        note: values.note || undefined,
      });
      setPendingNotice(
        data?.pendingActionId
          ? "Stock changes need Super Admin approval — this adjustment was submitted for review and is not live yet."
          : null
      );
      setIsAdjusting(false);
      loadLogs();
      loadLowStock();
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.message : "Could not adjust stock.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Inventory"
        description="Monitor stock levels and review adjustment history."
        action={
          <Button variant="primary" size="sm" onClick={() => setIsAdjusting(true)}>
            <Plus size={14} /> Adjust Stock
          </Button>
        }
      />

      {pendingNotice && (
        <div className="mb-6 rounded-lg border border-gold-500/40 bg-gold-soft p-4 text-sm text-gold-700">
          {pendingNotice}
        </div>
      )}

      <div className="mb-8">
        <h2 className="mb-3 font-serif text-lg text-green-950">Low Stock Alerts</h2>
        {isLowStockLoading ? (
          <TableSkeleton rows={2} />
        ) : lowStock.length === 0 ? (
          <p className="text-sm text-brown-500">All stock levels healthy.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {lowStock.map((entry) => (
              <div key={entry.product._id} className="rounded-lg border border-danger/20 bg-danger-soft px-4 py-3">
                <p className="font-medium text-green-950">{entry.product.name}</p>
                <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-danger">
                  {entry.lowStockVariants.map((v) => (
                    <li key={v._id}>
                      {v.label}: {v.stock} left (threshold {v.lowStockThreshold})
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      <h2 className="mb-3 font-serif text-lg text-green-950">Adjustment Log</h2>
      {isLoading ? (
        <TableSkeleton />
      ) : error ? (
        <ErrorState message={error} />
      ) : logs.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title="No inventory activity yet"
          description="Stock adjustments and order-driven changes will show up here."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-brown-600/10 bg-surface">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-brown-600/10 text-xs uppercase tracking-wide text-brown-500">
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Variant</th>
                <th className="px-4 py-3">Delta</th>
                <th className="px-4 py-3">Balance</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Note</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log._id} className="border-b border-brown-600/10 last:border-none">
                  <td className="px-4 py-3 font-medium text-green-950">{refName(log.product)}</td>
                  <td className="px-4 py-3 text-brown-600">{log.variantLabel}</td>
                  <td className={`px-4 py-3 font-semibold ${log.delta >= 0 ? "text-green-900" : "text-danger"}`}>
                    {log.delta >= 0 ? `+${log.delta}` : log.delta}
                  </td>
                  <td className="px-4 py-3 text-brown-600">{log.balanceAfter}</td>
                  <td className="px-4 py-3 text-brown-600">{REASON_LABELS[log.reason]}</td>
                  <td className="px-4 py-3 text-brown-600">{log.note ?? "—"}</td>
                  <td className="px-4 py-3 text-brown-600">{log.actor ? refName(log.actor) : "System"}</td>
                  <td className="px-4 py-3 text-brown-600">{new Date(log.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AdminPagination pagination={pagination} onPageChange={setPage} />

      {isAdjusting && (
        <Modal title="Adjust Stock" onClose={() => setIsAdjusting(false)}>
          <InventoryAdjustForm
            products={products}
            error={formError}
            isSubmitting={isSubmitting}
            onSubmit={handleAdjust}
            onCancel={() => setIsAdjusting(false)}
          />
        </Modal>
      )}
    </div>
  );
}
