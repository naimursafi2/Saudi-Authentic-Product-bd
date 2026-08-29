"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BadgeDollarSign,
  BarChart3,
  Receipt,
  ShoppingBag,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { getSalesSummary, getSalesTimeSeries } from "@/lib/api/reports";
import { getFinanceSummary, getRevenueVsExpense } from "@/lib/api/finance";
import { useAuth } from "@/context/AuthContext";
import { formatBDT } from "@/lib/utils";
import { downloadCsv } from "@/lib/csvExport";
import { orderStatusLabel } from "@/lib/orderStatus";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState, ErrorState } from "@/components/admin/EmptyState";
import { Button } from "@/components/ui/Button";
import { BreakdownBars, TrendChart } from "@/components/admin/charts/TrendChart";
import type { FinanceSummary, OrderStatus } from "@/types/api";
import type { RevenueVsExpensePoint, SalesSummary, SalesTimeSeriesPoint } from "@/types/hr";

/**
 * Business Overview. Everything here is read live from the existing reporting
 * and finance endpoints — there is no analytics-specific API and no stored
 * snapshot, so a figure on this page is the same figure the Reports and
 * Finance pages show.
 *
 * RBAC is the reason the page is built in two halves. `reports.view` gets the
 * sales half (revenue, orders, top products); the profit half needs
 * `finance.view`, which Co-Admin deliberately does not hold. A viewer without
 * it simply never sees — and never requests — cost, expense or profit data.
 * As everywhere else in this app the real boundary is server-side; this only
 * keeps the page honest about what it can show.
 */

type RangeKey = "day" | "week" | "month" | "custom";
type GroupBy = "day" | "week" | "month";

const RANGE_OPTIONS: { value: RangeKey; label: string; hint: string }[] = [
  { value: "day", label: "Daily", hint: "Last 30 days" },
  { value: "week", label: "Weekly", hint: "Last 12 weeks" },
  { value: "month", label: "Monthly", hint: "Last 12 months" },
  { value: "custom", label: "Custom", hint: "Pick your own dates" },
];

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** The preset ranges, expressed as the {from, groupBy} the API already takes. */
function presetRange(range: Exclude<RangeKey, "custom">): { from: string; groupBy: GroupBy } {
  const from = new Date();
  if (range === "day") from.setDate(from.getDate() - 29);
  else if (range === "week") from.setDate(from.getDate() - 7 * 11);
  else from.setMonth(from.getMonth() - 11);
  from.setHours(0, 0, 0, 0);
  return { from: isoDate(from), groupBy: range };
}

/** For a custom range, pick the bucket size that yields a readable number of
 * bars rather than making the user choose one as well as the dates. */
function groupByForSpan(from: string, to: string): GroupBy {
  const days = Math.max(1, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000));
  if (days <= 45) return "day";
  if (days <= 180) return "week";
  return "month";
}

const fieldClasses =
  "rounded border border-green-900/15 bg-cream-50 px-3 py-2 text-sm text-green-950 focus:border-green-900/40 focus:outline-none";
const labelClasses = "mb-1 block text-xs font-bold uppercase tracking-[0.06em] text-brown-600";

export default function AdminAnalyticsPage() {
  const { hasPermission } = useAuth();
  const canViewSales = hasPermission("reports.view");
  const canViewFinance = hasPermission("finance.view");

  const [range, setRange] = useState<RangeKey>("month");
  const [customFrom, setCustomFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return isoDate(d);
  });
  const [customTo, setCustomTo] = useState(() => isoDate(new Date()));
  /** The range actually applied — a custom range only takes effect on Apply,
   * so half-typed dates never fire a request. */
  const [applied, setApplied] = useState<{ from?: string; to?: string; groupBy: GroupBy }>(() => ({
    ...presetRange("month"),
  }));

  const [summary, setSummary] = useState<SalesSummary | null>(null);
  const [salesSeries, setSalesSeries] = useState<SalesTimeSeriesPoint[]>([]);
  const [finance, setFinance] = useState<FinanceSummary | null>(null);
  const [plSeries, setPlSeries] = useState<RevenueVsExpensePoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    (from: string | undefined, to: string | undefined, groupBy: GroupBy) => {
      setIsLoading(true);
      setError(null);

      const salesWork = Promise.all([
        getSalesSummary(from, to).then(({ data }) => setSummary(data.sales)),
        getSalesTimeSeries(groupBy, from, to).then(({ data }) => setSalesSeries(data.timeSeries)),
      ]);

      // Only a viewer who holds finance.view asks for the profit half at all.
      const financeWork = canViewFinance
        ? Promise.all([
            getFinanceSummary({ from, to }).then(({ data }) => setFinance(data.summary)),
            getRevenueVsExpense(groupBy, from, to).then(({ data }) => setPlSeries(data.timeSeries)),
          ])
        : Promise.resolve();

      Promise.all([salesWork, financeWork])
        .catch(() => setError("Could not load analytics for this period."))
        .finally(() => setIsLoading(false));
    },
    [canViewFinance]
  );

  // Same fetch-on-mount/on-filter-change shape (and the same lint exemption)
  // as every other data-backed admin page. A viewer without `reports.view`
  // renders the restricted state below and never reads `isLoading`, so there
  // is nothing to load for them.
  useEffect(() => {
    if (!canViewSales) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(applied.from, applied.to, applied.groupBy);
  }, [applied, canViewSales, load]);

  function selectRange(next: RangeKey) {
    setRange(next);
    if (next !== "custom") setApplied({ ...presetRange(next) });
  }

  function applyCustom(e: React.FormEvent) {
    e.preventDefault();
    setApplied({ from: customFrom, to: customTo, groupBy: groupByForSpan(customFrom, customTo) });
  }

  const periods = useMemo(() => salesSeries.map((p) => p.period), [salesSeries]);

  /** The P&L series keyed by period, so its bars line up with the sales bars
   * even when one side has a period the other doesn't. */
  const plByPeriod = useMemo(() => new Map(plSeries.map((row) => [row.period, row])), [plSeries]);

  function handleExportCsv() {
    const headers = ["Period", "Revenue (BDT)", "Orders"];
    if (canViewFinance) {
      headers.push("Cost of Goods Sold (BDT)", "Expenses (BDT)", "Net Profit (BDT)");
    }
    downloadCsv(
      `business-overview-${applied.groupBy}.csv`,
      headers,
      salesSeries.map((row) => {
        const base: (string | number)[] = [row.period, row.revenueBDT, row.orders];
        if (canViewFinance) {
          const pl = plByPeriod.get(row.period);
          base.push(pl?.costOfGoodsSoldBDT ?? 0, pl?.expenseBDT ?? 0, pl?.profitBDT ?? 0);
        }
        return base;
      })
    );
  }

  if (!canViewSales) {
    return (
      <div>
        <PageHeader title="Business Overview" />
        <EmptyState
          icon={BarChart3}
          title="Access restricted"
          description="Business analytics is available to roles that can view reports."
        />
      </div>
    );
  }

  const activeHint = RANGE_OPTIONS.find((o) => o.value === range)?.hint ?? "";
  const periodLabel =
    range === "custom" ? `${applied.from} to ${applied.to}` : activeHint.toLowerCase();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Business Overview"
        description="How the business is performing — sales, costs and profit, straight from live data."
      />

      {/* -- Period switcher -- */}
      <div className="flex flex-col gap-4 rounded-xl border border-brown-600/10 bg-surface p-4">
        <div className="flex flex-wrap items-center gap-2">
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => selectRange(option.value)}
              aria-pressed={range === option.value}
              className={`cursor-pointer rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                range === option.value
                  ? "bg-brand-deep text-on-brand"
                  : "bg-cream-200 text-brown-600 hover:bg-cream-300"
              }`}
            >
              {option.label}
            </button>
          ))}
          <span className="ml-1 text-xs text-brown-500">{activeHint}</span>
        </div>

        {range === "custom" && (
          <form onSubmit={applyCustom} className="flex flex-wrap items-end gap-3 border-t border-brown-600/10 pt-4">
            <div>
              <label className={labelClasses}>From</label>
              <input
                type="date"
                required
                value={customFrom}
                max={customTo}
                onChange={(e) => setCustomFrom(e.target.value)}
                className={fieldClasses}
              />
            </div>
            <div>
              <label className={labelClasses}>To</label>
              <input
                type="date"
                required
                value={customTo}
                min={customFrom}
                onChange={(e) => setCustomTo(e.target.value)}
                className={fieldClasses}
              />
            </div>
            <Button type="submit" variant="primary" size="sm">
              Apply
            </Button>
            <p className="text-xs text-brown-500">
              Grouped by {groupByForSpan(customFrom, customTo)} for readability.
            </p>
          </form>
        )}
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-surface" />
            ))}
          </div>
          <div className="h-72 animate-pulse rounded-xl bg-surface" />
        </div>
      ) : error ? (
        <ErrorState message={error} />
      ) : (
        <>
          <KpiGrid summary={summary} finance={canViewFinance ? finance : null} periodLabel={periodLabel} />

          <ChartCard
            title="Sales & Orders"
            subtitle={`Revenue taken and orders placed, ${periodLabel}. Hover a bar for the exact figure.`}
            action={
              <Button variant="outline" size="xs" onClick={handleExportCsv} disabled={salesSeries.length === 0}>
                Export CSV
              </Button>
            }
          >
            <TrendChart
              periods={periods}
              series={[
                {
                  key: "revenue",
                  label: "Revenue",
                  className: "fill-green-900",
                  values: salesSeries.map((p) => p.revenueBDT),
                },
              ]}
              emptyMessage="No sales in this period."
            />
          </ChartCard>

          <ChartCard title="Orders Placed" subtitle={`Number of orders, ${periodLabel}.`}>
            <TrendChart
              periods={periods}
              series={[
                {
                  key: "orders",
                  label: "Orders",
                  className: "fill-gold-600",
                  values: salesSeries.map((p) => p.orders),
                },
              ]}
              valueKind="count"
              emptyMessage="No orders in this period."
            />
          </ChartCard>

          {canViewFinance && (
            <ChartCard
              title="Profit & Loss"
              subtitle={`What was earned against what the goods and running costs took, ${periodLabel}. Bars below the line are a loss.`}
            >
              <TrendChart
                periods={periods}
                series={[
                  {
                    key: "revenue",
                    label: "Sales revenue",
                    className: "fill-green-900",
                    values: periods.map((p) => plByPeriod.get(p)?.netSellingRevenueBDT ?? 0),
                  },
                  {
                    key: "cogs",
                    label: "Product cost",
                    className: "fill-brown-500",
                    values: periods.map((p) => plByPeriod.get(p)?.costOfGoodsSoldBDT ?? 0),
                  },
                  {
                    key: "expense",
                    label: "Other expenses",
                    className: "fill-gold-600",
                    values: periods.map((p) => plByPeriod.get(p)?.expenseBDT ?? 0),
                  },
                  {
                    key: "profit",
                    label: "Profit / loss",
                    className: "fill-brand-deep",
                    values: periods.map((p) => plByPeriod.get(p)?.profitBDT ?? 0),
                  },
                ]}
                emptyMessage="No financial activity in this period."
              />
            </ChartCard>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ChartCard title="Where Orders Are" subtitle="Every order in this period by its current status.">
              <BreakdownBars
                rows={Object.entries(summary?.ordersByStatus ?? {})
                  .sort((a, b) => b[1] - a[1])
                  .map(([status, count]) => ({
                    label: orderStatusLabel(status as OrderStatus),
                    value: count,
                  }))}
                valueKind="count"
                emptyMessage="No orders in this period."
              />
              <Link
                href="/admin/orders"
                className="mt-4 inline-block text-xs font-bold uppercase tracking-[0.06em] text-green-900 hover:text-green-950"
              >
                Open orders
              </Link>
            </ChartCard>

            <ChartCard title="Best Sellers" subtitle="Top products by units sold in this period.">
              <BreakdownBars
                rows={(summary?.topProducts ?? []).map((p) => ({
                  label: p.name,
                  value: p.quantitySold,
                }))}
                valueKind="count"
                emptyMessage="No product sales in this period."
              />
            </ChartCard>
          </div>

          {canViewFinance && finance && (
            <ChartCard
              title="Where the Money Went"
              subtitle="Confirmed operating expenses by category. Stock purchases are not here — they count as product cost when the stock sells."
            >
              <BreakdownBars
                rows={Object.entries(finance.expensesByCategory)
                  .filter(([, amount]) => amount > 0)
                  .sort((a, b) => b[1] - a[1])
                  .map(([category, amount]) => ({
                    label: category.replace(/_/g, " "),
                    value: amount,
                  }))}
                barClassName="bg-gold-600"
                emptyMessage="No confirmed expenses in this period."
              />
            </ChartCard>
          )}

          {!canViewFinance && (
            <p className="rounded-xl border border-brown-600/10 bg-surface p-4 text-xs text-brown-500">
              Cost and profit figures are not shown for your role. Ask a Super Admin if you need finance access.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-brown-600/10 bg-surface p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-lg text-green-950">{title}</h2>
          {subtitle && <p className="mt-1 max-w-2xl text-xs text-brown-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** The headline numbers. The finance half is simply absent for a viewer
 * without `finance.view`, rather than shown as zero or blanked out. */
function KpiGrid({
  summary,
  finance,
  periodLabel,
}: {
  summary: SalesSummary | null;
  finance: FinanceSummary | null;
  periodLabel: string;
}) {
  const tiles: { icon: typeof TrendingUp; label: string; value: string; tone?: "good" | "bad" }[] = [
    { icon: TrendingUp, label: "Revenue", value: formatBDT(summary?.totalRevenueBDT ?? 0) },
    { icon: ShoppingBag, label: "Orders", value: String(summary?.totalOrders ?? 0) },
    { icon: Receipt, label: "Average Order", value: formatBDT(summary?.averageOrderValueBDT ?? 0) },
  ];

  if (finance) {
    tiles.push(
      { icon: BadgeDollarSign, label: "Product Cost", value: formatBDT(finance.costOfGoodsSoldBDT) },
      { icon: TrendingDown, label: "Expenses", value: formatBDT(finance.totalExpensesBDT) },
      {
        icon: finance.grossProfitBDT >= 0 ? TrendingUp : TrendingDown,
        label: "Gross Profit",
        value: formatBDT(finance.grossProfitBDT),
        tone: finance.grossProfitBDT >= 0 ? "good" : "bad",
      },
      {
        icon: finance.netProfitBDT >= 0 ? TrendingUp : TrendingDown,
        label: finance.netProfitBDT >= 0 ? "Net Profit" : "Net Loss",
        value: formatBDT(finance.netProfitBDT),
        tone: finance.netProfitBDT >= 0 ? "good" : "bad",
      },
      { icon: Wallet, label: "Cash Balance", value: formatBDT(finance.cashBalanceBDT) }
    );
  }

  return (
    <div>
      <p className="mb-3 text-xs font-bold uppercase tracking-[0.06em] text-brown-500">
        Totals for {periodLabel}
      </p>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.label} className="flex flex-col gap-3 rounded-xl border border-brown-600/10 bg-surface p-4">
            <span
              className={`flex size-9 shrink-0 items-center justify-center rounded-full ${
                tile.tone === "bad" ? "bg-danger-soft text-danger" : "bg-green-950/5 text-green-900"
              }`}
            >
              <tile.icon size={16} />
            </span>
            <span>
              <span
                className={`block text-lg font-semibold ${
                  tile.tone === "bad" ? "text-danger" : "text-green-950"
                }`}
              >
                {tile.value}
              </span>
              <span className="block text-xs text-brown-500">{tile.label}</span>
            </span>
          </div>
        ))}
      </div>
      {finance && finance.ordersWithUnknownCostBasis > 0 && (
        <p className="mt-3 text-xs text-gold-700">
          {finance.ordersWithUnknownCostBasis} order(s) in this period include an item with no purchase-batch cost
          recorded, so product cost and profit are partial totals.
        </p>
      )}
    </div>
  );
}
