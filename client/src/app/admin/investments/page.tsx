"use client";

import { useEffect, useState } from "react";
import { Plus, PiggyBank } from "lucide-react";
import { createInvestment, listInvestments } from "@/lib/api/finance";
import { ApiClientError } from "@/lib/api/client";
import { useAuth } from "@/context/AuthContext";
import { formatBDT } from "@/lib/utils";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState, TableSkeleton, ErrorState } from "@/components/admin/EmptyState";
import { Modal } from "@/components/admin/Modal";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { Button } from "@/components/ui/Button";
import type { ApiInvestment, Pagination } from "@/types/api";

function personName(person: ApiInvestment["recordedBy"]): string {
  return typeof person === "string" ? person : person.name;
}

const fieldClasses =
  "w-full rounded border border-green-900/15 bg-cream-50 px-3 py-2 text-sm text-green-950 placeholder:text-brown-500/50 focus:border-green-900/40 focus:outline-none";
const labelClasses = "mb-1 block text-xs font-bold uppercase tracking-[0.06em] text-brown-600";

export default function AdminInvestmentsPage() {
  const { user, hasPermission } = useAuth();
  const isRestricted = !hasPermission("investments.view");
  const canCreate = user?.role === "super_admin";

  const [investments, setInvestments] = useState<ApiInvestment[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [investorName, setInvestorName] = useState("");
  const [amountBDT, setAmountBDT] = useState("");
  const [investedAt, setInvestedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");

  function load() {
    setIsLoading(true);
    listInvestments({ page, limit: 20 })
      .then(({ data, pagination: pg }) => {
        setInvestments(data.investments);
        setPagination(pg ?? null);
        setError(null);
      })
      .catch(() => setError("Could not load investments."))
      .finally(() => setIsLoading(false));
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(load, [page]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);
    try {
      await createInvestment({
        investorName,
        amountBDT: Number(amountBDT),
        investedAt: new Date(investedAt).toISOString(),
        note: note || undefined,
      });
      setIsAdding(false);
      setInvestorName("");
      setAmountBDT("");
      setNote("");
      load();
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.message : "Could not record investment.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const total = investments.reduce((sum, inv) => sum + inv.amountBDT, 0);

  if (isRestricted) {
    return (
      <div>
        <PageHeader title="Investments" />
        <EmptyState
          icon={PiggyBank}
          title="Access restricted"
          description="Investments is available to Admin and Super Admin only."
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Investments"
        description="Partner investment ledger — an append-only record, never edited or deleted."
        action={
          canCreate ? (
            <Button variant="primary" size="sm" onClick={() => setIsAdding(true)}>
              <Plus size={14} /> Record Investment
            </Button>
          ) : undefined
        }
      />

      {!isLoading && !error && investments.length > 0 && (
        <div className="mb-4 rounded-lg border border-brown-600/10 bg-surface p-4">
          <span className="text-xs font-bold uppercase tracking-wide text-brown-500">Total Recorded</span>
          <p className="text-2xl font-semibold text-green-950">{formatBDT(total)}</p>
        </div>
      )}

      {isLoading ? (
        <TableSkeleton />
      ) : error ? (
        <ErrorState message={error} />
      ) : investments.length === 0 ? (
        <EmptyState
          icon={PiggyBank}
          title="No investments recorded yet"
          description={canCreate ? "Record the first investment to start the ledger." : "Nothing recorded yet."}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-brown-600/10 bg-surface">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-brown-600/10 text-xs uppercase tracking-wide text-brown-500">
                <th className="px-4 py-3">Investor</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Recorded By</th>
                <th className="px-4 py-3">Note</th>
              </tr>
            </thead>
            <tbody>
              {investments.map((inv) => (
                <tr key={inv._id} className="border-b border-brown-600/10 last:border-none">
                  <td className="px-4 py-3 font-medium text-green-950">{inv.investorName}</td>
                  <td className="px-4 py-3 text-brown-600">{formatBDT(inv.amountBDT)}</td>
                  <td className="px-4 py-3 text-brown-600">{new Date(inv.investedAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-brown-600">{personName(inv.recordedBy)}</td>
                  <td className="px-4 py-3 text-brown-500">{inv.note ?? "—"}</td>
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
        <Modal title="Record Investment" onClose={() => setIsAdding(false)}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div>
              <label className={labelClasses}>Investor Name *</label>
              <input
                required
                value={investorName}
                onChange={(e) => setInvestorName(e.target.value)}
                className={fieldClasses}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClasses}>Amount (BDT) *</label>
                <input
                  required
                  type="number"
                  min={0}
                  value={amountBDT}
                  onChange={(e) => setAmountBDT(e.target.value)}
                  className={fieldClasses}
                />
              </div>
              <div>
                <label className={labelClasses}>Date *</label>
                <input
                  required
                  type="date"
                  value={investedAt}
                  onChange={(e) => setInvestedAt(e.target.value)}
                  className={fieldClasses}
                />
              </div>
            </div>
            <div>
              <label className={labelClasses}>Note</label>
              <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} className={fieldClasses} />
            </div>

            {formError && <p className="text-sm text-danger">{formError}</p>}

            <div className="flex justify-end gap-3 border-t border-brown-600/10 pt-4">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsAdding(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Record Investment"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
