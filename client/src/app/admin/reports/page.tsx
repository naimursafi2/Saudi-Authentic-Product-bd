"use client";

import { useEffect, useState } from "react";
import { ListFilter, Receipt, ShoppingBag, TrendingUp } from "lucide-react";
import { getSalesSummary } from "@/lib/api/reports";
import { formatBDT } from "@/lib/utils";
import { PageHeader } from "@/components/admin/PageHeader";
import { ErrorState } from "@/components/admin/EmptyState";
import { Button } from "@/components/ui/Button";
import type { SalesSummary } from "@/types/hr";

const fieldClasses =
  "w-full rounded border border-green-900/15 bg-cream-50 px-3 py-2 text-sm text-green-950 focus:border-green-900/40 focus:outline-none";
const labelClasses = "mb-1 block text-xs font-bold uppercase tracking-[0.06em] text-brown-600";

export default function AdminReportsPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [summary, setSummary] = useState<SalesSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load(fromDate?: string, toDate?: string) {
    setIsLoading(true);
    getSalesSummary(fromDate || undefined, toDate || undefined)
      .then(({ data }) => {
        setSummary(data.sales);
        setError(null);
      })
      .catch(() => setError("Could not load sales report."))
      .finally(() => setIsLoading(false));
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(load, []);

  function handleApply(e: React.FormEvent) {
    e.preventDefault();
    load(from, to);
  }

  return (
    <div>
      <PageHeader title="Reports" description="Deeper, date-range-filterable sales insight." />

      <form
        onSubmit={handleApply}
        className="mb-8 flex flex-wrap items-end gap-4 rounded-lg border border-brown-600/10 bg-surface p-4"
      >
        <div>
          <label className={labelClasses}>From</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={fieldClasses} />
        </div>
        <div>
          <label className={labelClasses}>To</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={fieldClasses} />
        </div>
        <Button type="submit" variant="primary" size="sm">
          <ListFilter size={15} />
          Apply
        </Button>
      </form>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-surface" />
          ))}
        </div>
      ) : error ? (
        <ErrorState message={error} />
      ) : summary ? (
        <>
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatTile icon={TrendingUp} label="Total Revenue" value={formatBDT(summary.totalRevenueBDT)} />
            <StatTile icon={ShoppingBag} label="Total Orders" value={String(summary.totalOrders)} />
            <StatTile
              icon={Receipt}
              label="Average Order Value"
              value={formatBDT(summary.averageOrderValueBDT)}
            />
          </div>

          <div className="mb-8 rounded-lg border border-brown-600/10 bg-surface p-5">
            <h2 className="mb-3 font-serif text-lg text-green-950">Orders by Status</h2>
            {Object.keys(summary.ordersByStatus).length === 0 ? (
              <p className="text-sm text-brown-500">No orders in this range.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {Object.entries(summary.ordersByStatus).map(([status, count]) => (
                  <div
                    key={status}
                    className="flex items-center justify-between border-b border-brown-600/10 py-2 text-sm last:border-none"
                  >
                    <span className="capitalize text-brown-600">{status.replace("_", " ")}</span>
                    <span className="font-semibold text-green-950">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-brown-600/10 bg-surface p-5">
            <h2 className="mb-3 font-serif text-lg text-green-950">Top Products</h2>
            {summary.topProducts.length === 0 ? (
              <p className="text-sm text-brown-500">No product sales in this range.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-brown-600/10 text-xs uppercase tracking-wide text-brown-500">
                    <th className="py-2">Product</th>
                    <th className="py-2">Qty Sold</th>
                    <th className="py-2">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.topProducts.map((p) => (
                    <tr key={p._id} className="border-b border-brown-600/10 last:border-none">
                      <td className="py-2 font-medium text-green-950">{p.name}</td>
                      <td className="py-2 text-brown-600">{p.quantitySold}</td>
                      <td className="py-2 text-brown-600">{formatBDT(p.revenueBDT)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof TrendingUp;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-lg border border-brown-600/10 bg-surface p-5">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-green-950/5 text-green-900">
        <Icon size={18} />
      </span>
      <span>
        <p className="text-xs font-bold uppercase tracking-[0.06em] text-brown-500">{label}</p>
        <p className="mt-1 font-serif text-2xl text-green-950">{value}</p>
      </span>
    </div>
  );
}
