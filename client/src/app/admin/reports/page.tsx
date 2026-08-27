"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Download, FileDown, ListFilter, Receipt, ShoppingBag, TrendingUp } from "lucide-react";
import { getDeliveryAgentPerformance, getSalesReportPdf, getSalesSummary, getSalesTimeSeries } from "@/lib/api/reports";
import { getSiteSettings } from "@/lib/api/siteSettings";
import { formatBDT } from "@/lib/utils";
import { downloadBlob, downloadCsv } from "@/lib/csvExport";
import { ApiClientError } from "@/lib/api/client";
import { PageHeader } from "@/components/admin/PageHeader";
import { ErrorState } from "@/components/admin/EmptyState";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Button } from "@/components/ui/Button";
import type { SalesSummary, SalesTimeSeriesPoint } from "@/types/hr";
import type { ApiDeliveryAgentPerformance, ApiSiteSettings } from "@/types/api";

type GroupBy = "day" | "week" | "month";
const GROUP_BY_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: "day", label: "Daily" },
  { value: "week", label: "Weekly" },
  { value: "month", label: "Monthly" },
];

const fieldClasses =
  "w-full rounded border border-green-900/15 bg-cream-50 px-3 py-2 text-sm text-green-950 focus:border-green-900/40 focus:outline-none";
const labelClasses = "mb-1 block text-xs font-bold uppercase tracking-[0.06em] text-brown-600";

export default function AdminReportsPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [summary, setSummary] = useState<SalesSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [agents, setAgents] = useState<ApiDeliveryAgentPerformance[] | null>(null);
  const [groupBy, setGroupBy] = useState<GroupBy>("day");
  const [timeSeries, setTimeSeries] = useState<SalesTimeSeriesPoint[]>([]);
  const [isTimeSeriesLoading, setIsTimeSeriesLoading] = useState(true);
  const [siteSettings, setSiteSettings] = useState<ApiSiteSettings | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

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

  function loadTimeSeries(by: GroupBy, fromDate?: string, toDate?: string) {
    setIsTimeSeriesLoading(true);
    getSalesTimeSeries(by, fromDate || undefined, toDate || undefined)
      .then(({ data }) => setTimeSeries(data.timeSeries))
      .catch(() => setTimeSeries([]))
      .finally(() => setIsTimeSeriesLoading(false));
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(load, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => loadTimeSeries(groupBy), [groupBy]);

  useEffect(() => {
    getDeliveryAgentPerformance()
      .then(({ data }) => setAgents(data.agents))
      .catch(() => setAgents([]));
  }, []);

  useEffect(() => {
    getSiteSettings()
      .then(({ data }) => setSiteSettings(data.settings))
      .catch(() => setSiteSettings(null));
  }, []);

  function handleApply(e: React.FormEvent) {
    e.preventDefault();
    load(from, to);
    loadTimeSeries(groupBy, from, to);
  }

  function handleExportCsv() {
    downloadCsv(
      `sales-report-${groupBy}.csv`,
      ["Period", "Revenue (BDT)", "Orders"],
      timeSeries.map((row) => [row.period, row.revenueBDT, row.orders])
    );
  }

  /**
   * Generates a real PDF server-side and downloads it directly — no
   * `window.print()`, no browser print dialog, no dependency on the OS's
   * "Microsoft Print to PDF" driver (whose own save dialog no webpage can
   * reach or pre-fill; `document.title` only ever affected Chrome's own
   * built-in "Save as PDF" destination, a different flow entirely). The
   * filename is generated here, from the browser's local clock at the
   * exact moment Export is clicked, and applied directly via the download
   * trigger (`downloadBlob`) — a real file download's name is fully
   * client-controlled, unlike a print dialog's suggested filename.
   */
  async function handleExportPdf() {
    setPdfError(null);
    setIsExportingPdf(true);
    try {
      const blob = await getSalesReportPdf(groupBy, from || undefined, to || undefined);
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      downloadBlob(`${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()}.pdf`, blob);
    } catch (err) {
      setPdfError(err instanceof ApiClientError ? err.message : "Could not generate the PDF.");
    } finally {
      setIsExportingPdf(false);
    }
  }

  return (
    <div>
      <div className="print:hidden">
        <PageHeader title="Reports" description="Deeper, date-range-filterable sales insight." />
      </div>

      <form
        onSubmit={handleApply}
        className="mb-8 flex flex-wrap items-end gap-4 rounded-lg border border-brown-600/10 bg-surface p-4 print:hidden"
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
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3 print:hidden">
            <StatTile icon={TrendingUp} label="Total Revenue" value={formatBDT(summary.totalRevenueBDT)} />
            <StatTile icon={ShoppingBag} label="Total Orders" value={String(summary.totalOrders)} />
            <StatTile
              icon={Receipt}
              label="Average Order Value"
              value={formatBDT(summary.averageOrderValueBDT)}
            />
          </div>

          <div className="print-header">
            <strong>{siteSettings?.siteName ?? "Saudi Authentic Product"}</strong>
            <br />
            Report date: {new Date().toLocaleDateString()}
          </div>
          <p className="print-footer">
            {siteSettings?.siteName ?? "Saudi Authentic Product"}
            {siteSettings?.contactEmail
              ? ` · ${siteSettings.contactEmail}`
              : siteSettings?.contactPhone
                ? ` · ${siteSettings.contactPhone}`
                : ""}
          </p>

          <div className="print-area mb-8 rounded-lg border border-brown-600/10 bg-surface p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-serif text-lg text-green-950">
                {GROUP_BY_OPTIONS.find((o) => o.value === groupBy)?.label} Sales Report
              </h2>
              <div className="flex flex-wrap items-center gap-2 print:hidden">
                <select
                  value={groupBy}
                  onChange={(e) => setGroupBy(e.target.value as GroupBy)}
                  className="h-8 rounded border border-brown-600/20 bg-surface px-2 text-xs text-green-950 focus:outline-none focus:ring-1 focus:ring-green-900/30"
                >
                  {GROUP_BY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <Button variant="outline" size="xs" onClick={handleExportCsv} disabled={timeSeries.length === 0}>
                  <Download size={13} /> CSV
                </Button>
                <Button
                  variant="outline"
                  size="xs"
                  onClick={handleExportPdf}
                  disabled={timeSeries.length === 0 || isExportingPdf}
                >
                  <FileDown size={13} /> {isExportingPdf ? "Generating..." : "Export PDF"}
                </Button>
              </div>
            </div>
            {pdfError && <p className="mb-2 text-xs text-danger print:hidden">{pdfError}</p>}
            <p className="mb-3 text-xs text-brown-500">
              Period: {from || "Earliest order"} &ndash; {to || "Latest order"}
            </p>
            {isTimeSeriesLoading ? (
              <div className="h-32 animate-pulse rounded-lg bg-cream-200" />
            ) : timeSeries.length === 0 ? (
              <p className="text-sm text-brown-500">No sales in this range.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-brown-600/10 text-xs uppercase tracking-wide text-brown-500">
                    <th className="py-2">Period</th>
                    <th className="py-2">Revenue</th>
                    <th className="py-2">Orders</th>
                  </tr>
                </thead>
                <tbody>
                  {timeSeries.map((row) => (
                    <tr key={row.period} className="border-b border-brown-600/10 last:border-none">
                      <td className="py-2 font-medium text-green-950">{row.period}</td>
                      <td className="py-2 text-brown-600">{formatBDT(row.revenueBDT)}</td>
                      <td className="py-2 text-brown-600">{row.orders}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="mb-8 rounded-lg border border-brown-600/10 bg-surface p-5 print:hidden">
            <h2 className="mb-3 font-serif text-lg text-green-950">Orders by Status</h2>
            <p className="mb-3 text-xs text-brown-500">Click a status to view those orders.</p>
            {Object.keys(summary.ordersByStatus).length === 0 ? (
              <p className="text-sm text-brown-500">No orders in this range.</p>
            ) : (
              <div className="flex flex-col gap-1">
                {Object.entries(summary.ordersByStatus).map(([status, count]) => (
                  <Link
                    key={status}
                    href={`/admin/orders?status=${status}`}
                    className="flex items-center justify-between rounded border-b border-brown-600/10 px-2 py-2 text-sm transition-colors last:border-none hover:bg-cream-100"
                  >
                    <span className="capitalize text-brown-600">{status.replace("_", " ")}</span>
                    <span className="font-semibold text-green-950">{count}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-brown-600/10 bg-surface p-5 print:hidden">
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

      <div className="mt-8 rounded-lg border border-brown-600/10 bg-surface p-5 print:hidden">
        <h2 className="mb-1 font-serif text-lg text-green-950">Delivery Agent Performance</h2>
        <p className="mb-3 text-xs text-brown-500">
          Live counts derived from assigned orders — not a separate tracked number.
        </p>
        {agents === null ? (
          <div className="h-24 animate-pulse rounded-lg bg-cream-200" />
        ) : agents.length === 0 ? (
          <p className="text-sm text-brown-500">No delivery agents yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-brown-600/10 text-xs uppercase tracking-wide text-brown-500">
                <th className="py-2">Agent</th>
                <th className="py-2">Status</th>
                <th className="py-2">Assigned</th>
                <th className="py-2">Delivered</th>
                <th className="py-2">Failed</th>
                <th className="py-2">Success Rate</th>
                <th className="py-2">Avg. Delivery Time</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent) => (
                <tr key={agent.agentId} className="border-b border-brown-600/10 last:border-none">
                  <td className="py-2">
                    <p className="font-medium text-green-950">{agent.name}</p>
                    <p className="text-xs text-brown-500">{agent.email}</p>
                  </td>
                  <td className="py-2">
                    <StatusBadge status={agent.isActive ? "active" : "inactive"} />
                  </td>
                  <td className="py-2 text-brown-600">{agent.assignedCount}</td>
                  <td className="py-2 text-brown-600">{agent.deliveredCount}</td>
                  <td className="py-2 text-brown-600">{agent.failedCount}</td>
                  <td className="py-2 text-brown-600">
                    {agent.successRate === null ? "—" : `${agent.successRate}%`}
                  </td>
                  <td className="py-2 text-brown-600">
                    {agent.averageDeliveryHours === null ? "—" : `${agent.averageDeliveryHours} hrs`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
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
