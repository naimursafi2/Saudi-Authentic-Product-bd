"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BadgeDollarSign,
  ChartPie,
  Download,
  Package,
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
import { BreakdownBars, TrendChart, formatPeriod } from "@/components/admin/charts/TrendChart";
import type { FinanceSummary, OrderStatus } from "@/types/api";
import type { RevenueVsExpensePoint, SalesSummary, SalesTimeSeriesPoint } from "@/types/hr";

/**
 * Analytics / Business Overview. Everything is read live from the existing
 * reporting and finance endpoints — there is no analytics-specific API and no
 * stored snapshot, so a figure here is the same figure the Reports and Finance
 * pages show.
 *
 * RBAC splits the page in two. `reports.view` gets the sales half (revenue,
 * orders, top products); the profit half needs `finance.view`, which Co-Admin
 * deliberately does not hold — a viewer without it never sees, and never
 * requests, cost or profit data. Super Admin holds every permission, so it
 * sees the whole page. As everywhere else the real boundary is server-side.
 */

type RangeKey = "day" | "week" | "month" | "custom";
type GroupBy = "day" | "week" | "month";

const RANGE_OPTIONS: { value: RangeKey; label: string; hint: string }[] = [
  { value: "day", label: "Day", hint: "Last 30 days" },
  { value: "week", label: "Week", hint: "Last 12 weeks" },
  { value: "month", label: "Month", hint: "Last 12 months" },
  { value: "custom", label: "Custom", hint: "Choose your own dates" },
];

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function presetRange(range: Exclude<RangeKey, "custom">): { from: string; groupBy: GroupBy } {
  const from = new Date();
  if (range === "day") from.setDate(from.getDate() - 29);
  else if (range === "week") from.setDate(from.getDate() - 7 * 11);
  else from.setMonth(from.getMonth() - 11);
  from.setHours(0, 0, 0, 0);
  return { from: isoDate(from), groupBy: range };
}

/** Picks a bucket size that yields a readable number of bars, so a custom
 * range doesn't also make the user choose a grouping. */
function groupByForSpan(from: string, to: string): GroupBy {
  const days = Math.max(1, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000));
  if (days <= 45) return "day";
  if (days <= 180) return "week";
  return "month";
}

const fieldClasses =
  "h-10 rounded-lg border border-green-900/15 bg-cream-50 px-3 text-sm tabular-nums text-green-950 focus:border-green-900/40 focus:outline-none focus:ring-2 focus:ring-green-900/10";
const labelClasses = "mb-1.5 block text-[11px] font-bold uppercase tracking-[0.08em] text-brown-500";

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

  useEffect(() => {
    if (!canViewSales) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(applied.from, applied.to, applied.groupBy);
  }, [applied, canViewSales, load]);

  function selectRange(next: RangeKey) {
    setRange(next);
    // Switching to Custom applies the dates already in the inputs straight
    // away. Leaving the previous preset's range applied while the header reads
    // "Custom" would show one range and describe another.
    setApplied(
      next === "custom"
        ? { from: customFrom, to: customTo, groupBy: groupByForSpan(customFrom, customTo) }
        : { ...presetRange(next) }
    );
  }

  function applyCustom(e: React.FormEvent) {
    e.preventDefault();
    setApplied({ from: customFrom, to: customTo, groupBy: groupByForSpan(customFrom, customTo) });
  }

  const periods = useMemo(() => salesSeries.map((p) => p.period), [salesSeries]);
  const plByPeriod = useMemo(() => new Map(plSeries.map((row) => [row.period, row])), [plSeries]);

  function handleExportCsv() {
    const headers = ["Period", "Revenue (BDT)", "Orders"];
    if (canViewFinance) headers.push("Cost of Goods Sold (BDT)", "Expenses (BDT)", "Net Profit (BDT)");
    downloadCsv(
      `analytics-${applied.groupBy}.csv`,
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
        <PageHeader title="Analytics" />
        <EmptyState
          icon={ChartPie}
          title="Access restricted"
          description="Business analytics is available to roles that can view reports."
        />
      </div>
    );
  }

  const periodLabel =
    applied.from && applied.to
      ? `${formatPeriod(applied.from, "day", true)} – ${formatPeriod(applied.to, "day", true)}`
      : (RANGE_OPTIONS.find((o) => o.value === range)?.hint ?? "").toLowerCase();

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        title="Analytics"
        description="How the business is performing — sales, costs and profit, straight from live data."
      />

      {/* -- Period switcher -- */}
      <section className="rounded-xl border border-brown-600/10 bg-surface p-5 shadow-[0_1px_2px_rgba(61,43,31,0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className={labelClasses + " mb-0 mr-1"}>Show</span>
            <div className="flex rounded-lg bg-cream-200 p-1">
              {RANGE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => selectRange(option.value)}
                  aria-pressed={range === option.value}
                  className={`cursor-pointer rounded-md px-4 py-1.5 text-sm font-semibold transition-all ${
                    range === option.value
                      ? "bg-surface text-green-950 shadow-sm"
                      : "text-brown-500 hover:text-green-950"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <p className="text-sm text-brown-500">
            Showing <span className="font-semibold text-green-950">{periodLabel}</span>
          </p>
        </div>

        {range === "custom" && (
          <form
            onSubmit={applyCustom}
            className="mt-4 flex flex-wrap items-end gap-3 border-t border-brown-600/10 pt-4"
          >
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
            <p className="pb-2 text-xs text-brown-500">
              Grouped by {groupByForSpan(customFrom, customTo)} so the chart stays readable.
            </p>
          </form>
        )}
      </section>

      {isLoading ? (
        <LoadingSkeleton />
      ) : error ? (
        <ErrorState message={error} />
      ) : (
        <>
          <KpiGrid summary={summary} finance={canViewFinance ? finance : null} />

          <ChartCard
            title="Revenue"
            subtitle="Total sales taken in each period, including shipping."
            action={
              <Button variant="outline" size="xs" onClick={handleExportCsv} disabled={salesSeries.length === 0}>
                <Download size={13} /> Export CSV
              </Button>
            }
          >
            <TrendChart
              groupBy={applied.groupBy}
              variant="area"
              periods={periods}
              series={[
                {
                  key: "revenue",
                  label: "Revenue",
                  colorClass: "text-green-900",
                  values: salesSeries.map((p) => p.revenueBDT),
                },
              ]}
              emptyMessage="No sales in this period."
            />
          </ChartCard>

          <ChartCard title="Orders" subtitle="How many orders were placed in each period.">
            <TrendChart
              groupBy={applied.groupBy}
              periods={periods}
              series={[
                {
                  key: "orders",
                  label: "Orders",
                  colorClass: "text-gold-600",
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
              subtitle="Sales against what the goods cost and what the business spent. Bars below the line are a loss."
            >
              <TrendChart
                groupBy={applied.groupBy}
                periods={periods}
                series={[
                  {
                    key: "revenue",
                    label: "Sales",
                    colorClass: "text-green-900",
                    values: periods.map((p) => plByPeriod.get(p)?.netSellingRevenueBDT ?? 0),
                  },
                  {
                    key: "cogs",
                    label: "Product cost",
                    colorClass: "text-brown-500",
                    values: periods.map((p) => plByPeriod.get(p)?.costOfGoodsSoldBDT ?? 0),
                  },
                  {
                    key: "expense",
                    label: "Expenses",
                    colorClass: "text-gold-600",
                    values: periods.map((p) => plByPeriod.get(p)?.expenseBDT ?? 0),
                  },
                  {
                    key: "profit",
                    label: "Net profit",
                    colorClass: "text-brand-deep",
                    values: periods.map((p) => plByPeriod.get(p)?.profitBDT ?? 0),
                  },
                ]}
                emptyMessage="No financial activity in this period."
              />
            </ChartCard>
          )}

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <ChartCard title="Order Status" subtitle="Where this period's orders currently sit.">
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
                className="mt-5 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.08em] text-green-900 transition-colors hover:text-green-950"
              >
                Open orders <ArrowRight size={12} />
              </Link>
            </ChartCard>

            <ChartCard title="Best Sellers" subtitle="Top products by units sold in this period.">
              <BreakdownBars
                rows={(summary?.topProducts ?? []).map((p) => ({ label: p.name, value: p.quantitySold }))}
                valueKind="count"
                colorClass="text-gold-600"
                emptyMessage="No product sales in this period."
              />
            </ChartCard>
          </div>

          {canViewFinance && finance && (
            <ChartCard
              title="Expenses by Category"
              subtitle="Confirmed operating spend. Stock purchases are not here — they reach the P&L as product cost when the stock sells."
            >
              <BreakdownBars
                rows={Object.entries(finance.expensesByCategory)
                  .filter(([, amount]) => amount > 0)
                  .sort((a, b) => b[1] - a[1])
                  .map(([category, amount]) => ({ label: category.replace(/_/g, " "), value: amount }))}
                colorClass="text-brown-500"
                emptyMessage="No confirmed expenses in this period."
              />
            </ChartCard>
          )}

          {!canViewFinance && (
            <p className="rounded-xl border border-brown-600/10 bg-surface p-4 text-sm text-brown-500">
              Cost and profit figures are hidden for your role. Ask a Super Admin if you need finance access.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-7">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-[104px] animate-pulse rounded-xl bg-surface" />
        ))}
      </div>
      <div className="h-[420px] animate-pulse rounded-xl bg-surface" />
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
    <section className="rounded-xl border border-brown-600/10 bg-surface p-6 shadow-[0_1px_2px_rgba(61,43,31,0.04)]">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-lg font-semibold tracking-tight text-green-950">{title}</h2>
          {subtitle && <p className="mt-1 max-w-2xl text-sm leading-relaxed text-brown-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/**
 * The headline numbers. The finance half is simply absent for a viewer without
 * `finance.view`, rather than shown as zero or blanked out.
 */
function KpiGrid({ summary, finance }: { summary: SalesSummary | null; finance: FinanceSummary | null }) {
  const tiles: {
    icon: typeof TrendingUp;
    label: string;
    value: string;
    hint?: string;
    tone?: "good" | "bad";
  }[] = [
    { icon: TrendingUp, label: "Revenue", value: formatBDT(summary?.totalRevenueBDT ?? 0), hint: "Sales incl. shipping" },
    { icon: ShoppingBag, label: "Orders", value: String(summary?.totalOrders ?? 0), hint: "Orders placed" },
    {
      icon: Receipt,
      label: "Average Order",
      value: formatBDT(summary?.averageOrderValueBDT ?? 0),
      hint: "Revenue per order",
    },
    {
      icon: Package,
      label: "Products Sold",
      value: String((summary?.topProducts ?? []).reduce((sum, p) => sum + p.quantitySold, 0)),
      hint: "Units, top products",
    },
  ];

  if (finance) {
    tiles.push(
      {
        icon: BadgeDollarSign,
        label: "COGS",
        value: formatBDT(finance.costOfGoodsSoldBDT),
        hint: "Cost of goods sold",
      },
      {
        icon: TrendingDown,
        label: "Expenses",
        value: formatBDT(finance.totalExpensesBDT),
        hint: "Confirmed operating spend",
      },
      {
        icon: finance.grossProfitBDT >= 0 ? TrendingUp : TrendingDown,
        label: "Gross Profit",
        value: formatBDT(finance.grossProfitBDT),
        hint: "Sales minus product cost",
        tone: finance.grossProfitBDT >= 0 ? "good" : "bad",
      },
      {
        icon: finance.netProfitBDT >= 0 ? TrendingUp : TrendingDown,
        label: finance.netProfitBDT >= 0 ? "Net Profit" : "Net Loss",
        value: formatBDT(finance.netProfitBDT),
        hint: "After all expenses",
        tone: finance.netProfitBDT >= 0 ? "good" : "bad",
      },
      { icon: Wallet, label: "Cash Balance", value: formatBDT(finance.cashBalanceBDT), hint: "Investment + sales − spend" }
    );
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
        {tiles.map((tile) => (
          <div
            key={tile.label}
            className="rounded-xl border border-brown-600/10 bg-surface p-5 shadow-[0_1px_2px_rgba(61,43,31,0.04)] transition-shadow hover:shadow-md"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-brown-500">{tile.label}</span>
              <span
                className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${
                  tile.tone === "bad" ? "bg-danger-soft text-danger" : "bg-green-950/5 text-green-900"
                }`}
              >
                <tile.icon size={15} />
              </span>
            </div>
            <p
              className={`font-serif text-[26px] font-semibold leading-none tracking-tight tabular-nums ${
                tile.tone === "bad" ? "text-danger" : "text-green-950"
              }`}
            >
              {tile.value}
            </p>
            {tile.hint && <p className="mt-2 text-xs text-brown-500">{tile.hint}</p>}
          </div>
        ))}
      </div>
      {finance && finance.ordersWithUnknownCostBasis > 0 && (
        <p className="mt-3 rounded-lg border border-gold-500/40 bg-gold-soft px-4 py-2.5 text-xs text-gold-700">
          {finance.ordersWithUnknownCostBasis} order(s) in this period include an item with no purchase-batch cost
          recorded, so product cost and profit are partial totals.
        </p>
      )}
    </div>
  );
}
