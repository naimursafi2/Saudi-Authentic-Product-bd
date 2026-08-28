"use client";

import { useEffect, useState } from "react";
import { Download, Landmark, TrendingUp, TrendingDown, PiggyBank, Wallet, ShoppingBag, Warehouse, BadgeDollarSign } from "lucide-react";
import { getFinanceSummary, getRevenueVsExpense, getGrossProfit, getInventoryValuation } from "@/lib/api/finance";
import { useAuth } from "@/context/AuthContext";
import { formatBDT, formatBDTPrecise } from "@/lib/utils";
import { downloadCsv } from "@/lib/csvExport";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState, TableSkeleton, ErrorState } from "@/components/admin/EmptyState";
import { Button } from "@/components/ui/Button";
import type { FinanceSummary } from "@/types/api";
import type { GrossProfitPoint, InventoryValuation, RevenueVsExpensePoint } from "@/types/hr";

type GroupBy = "day" | "week" | "month";
const GROUP_BY_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: "day", label: "Daily" },
  { value: "week", label: "Weekly" },
  { value: "month", label: "Monthly" },
];

export default function AdminFinancePage() {
  const { hasPermission } = useAuth();
  const isRestricted = !hasPermission("finance.view");

  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<GroupBy>("month");
  const [timeSeries, setTimeSeries] = useState<RevenueVsExpensePoint[]>([]);
  const [isTimeSeriesLoading, setIsTimeSeriesLoading] = useState(true);

  const [profitGroupBy, setProfitGroupBy] = useState<GroupBy>("month");
  const [profitSeries, setProfitSeries] = useState<GrossProfitPoint[]>([]);
  const [isProfitLoading, setIsProfitLoading] = useState(true);

  const [valuation, setValuation] = useState<InventoryValuation | null>(null);
  const [isValuationLoading, setIsValuationLoading] = useState(true);

  function load() {
    setIsLoading(true);
    getFinanceSummary()
      .then(({ data }) => {
        setSummary(data.summary);
        setError(null);
      })
      .catch(() => setError("Could not load finance summary."))
      .finally(() => setIsLoading(false));
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(load, []);

  function loadTimeSeries(by: GroupBy) {
    setIsTimeSeriesLoading(true);
    getRevenueVsExpense(by)
      .then(({ data }) => setTimeSeries(data.timeSeries))
      .catch(() => setTimeSeries([]))
      .finally(() => setIsTimeSeriesLoading(false));
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => loadTimeSeries(groupBy), [groupBy]);

  function loadProfitSeries(by: GroupBy) {
    setIsProfitLoading(true);
    getGrossProfit(by)
      .then(({ data }) => setProfitSeries(data.timeSeries))
      .catch(() => setProfitSeries([]))
      .finally(() => setIsProfitLoading(false));
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => loadProfitSeries(profitGroupBy), [profitGroupBy]);

  useEffect(() => {
    getInventoryValuation()
      .then(({ data }) => setValuation(data))
      .catch(() => setValuation(null))
      .finally(() => setIsValuationLoading(false));
  }, []);

  function handleExportCsv() {
    downloadCsv(
      `revenue-vs-expense-${groupBy}.csv`,
      ["Period", "Revenue (BDT)", "Expense (BDT)", "Profit (BDT)"],
      timeSeries.map((row) => [row.period, row.revenueBDT, row.expenseBDT, row.profitBDT])
    );
  }

  function handleExportProfitCsv() {
    downloadCsv(
      `gross-profit-${profitGroupBy}.csv`,
      ["Period", "Net Selling Revenue (BDT)", "Cost of Goods Sold (BDT)", "Gross Profit (BDT)", "Orders"],
      profitSeries.map((row) => [
        row.period,
        row.netSellingRevenueBDT,
        row.costOfGoodsSoldBDT,
        row.grossProfitBDT,
        row.orders,
      ])
    );
  }

  if (isRestricted) {
    return (
      <div>
        <PageHeader title="Finance" />
        <EmptyState
          icon={Landmark}
          title="Access restricted"
          description="Finance is available to Admin and Super Admin only."
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Finance" description="Business summary — revenue, expenses, and profit/loss." />
        <TableSkeleton rows={4} />
      </div>
    );
  }

  if (error || !summary) {
    return <ErrorState message={error ?? "No data available."} />;
  }

  const statCards = [
    { icon: ShoppingBag, label: "Total Revenue", value: formatBDT(summary.totalRevenueBDT), tone: "green" },
    { icon: TrendingDown, label: "Total Expenses", value: formatBDT(summary.totalExpensesBDT), tone: "brown" },
    { icon: PiggyBank, label: "Total Investment", value: formatBDT(summary.totalInvestmentBDT), tone: "gold" },
    {
      icon: summary.netProfitBDT >= 0 ? TrendingUp : TrendingDown,
      label: "Net Profit / Loss",
      value: formatBDT(summary.netProfitBDT),
      tone: summary.netProfitBDT >= 0 ? "green" : "red",
    },
    { icon: Wallet, label: "Cash Balance", value: formatBDT(summary.cashBalanceBDT), tone: "green" },
  ];

  const categoryEntries = Object.entries(summary.expensesByCategory).filter(([, amount]) => amount > 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Finance"
        description="Business summary — revenue is derived from live orders, never duplicated."
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {statCards.map((card) => (
          <div key={card.label} className="flex flex-col gap-3 rounded-xl border border-brown-600/10 bg-surface p-4">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-green-950/5 text-green-900">
              <card.icon size={16} />
            </span>
            <span>
              <span className="block text-lg font-semibold text-green-950">{card.value}</span>
              <span className="block text-xs text-brown-500">{card.label}</span>
            </span>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-brown-600/10 bg-surface p-6">
        <h2 className="mb-4 flex items-center gap-2 font-serif text-lg text-green-950">
          <Landmark size={18} className="text-green-900" /> Expenses by Category
        </h2>
        {categoryEntries.length === 0 ? (
          <p className="text-sm text-brown-500">No confirmed expenses yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {categoryEntries.map(([category, amount]) => (
              <li key={category} className="flex items-center justify-between border-b border-brown-600/10 py-2 text-sm last:border-none">
                <span className="capitalize text-brown-600">{category.replace(/_/g, " ")}</span>
                <span className="font-semibold text-green-950">{formatBDT(amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-brown-600/10 bg-surface p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-serif text-lg text-green-950">
            <TrendingUp size={18} className="text-green-900" /> Revenue vs Expense
          </h2>
          <div className="flex flex-wrap items-center gap-2">
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
          </div>
        </div>
        {isTimeSeriesLoading ? (
          <div className="h-32 animate-pulse rounded-lg bg-cream-200" />
        ) : timeSeries.length === 0 ? (
          <p className="text-sm text-brown-500">No revenue or expense activity in this range.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-brown-600/10 text-xs uppercase tracking-wide text-brown-500">
                <th className="py-2">Period</th>
                <th className="py-2">Revenue</th>
                <th className="py-2">Expense</th>
                <th className="py-2">Profit</th>
              </tr>
            </thead>
            <tbody>
              {timeSeries.map((row) => (
                <tr key={row.period} className="border-b border-brown-600/10 last:border-none">
                  <td className="py-2 font-medium text-green-950">{row.period}</td>
                  <td className="py-2 text-brown-600">{formatBDT(row.revenueBDT)}</td>
                  <td className="py-2 text-brown-600">{formatBDT(row.expenseBDT)}</td>
                  <td className={`py-2 font-semibold ${row.profitBDT >= 0 ? "text-green-900" : "text-danger"}`}>
                    {formatBDT(row.profitBDT)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="rounded-xl border border-brown-600/10 bg-surface p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-serif text-lg text-green-950">
            <BadgeDollarSign size={18} className="text-green-900" /> Gross Profit (Landed Cost)
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={profitGroupBy}
              onChange={(e) => setProfitGroupBy(e.target.value as GroupBy)}
              className="h-8 rounded border border-brown-600/20 bg-surface px-2 text-xs text-green-950 focus:outline-none focus:ring-1 focus:ring-green-900/30"
            >
              {GROUP_BY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <Button variant="outline" size="xs" onClick={handleExportProfitCsv} disabled={profitSeries.length === 0}>
              <Download size={13} /> CSV
            </Button>
          </div>
        </div>
        <p className="mb-3 text-xs text-brown-500">
          Net selling revenue (subtotal minus discount) minus the actual landed cost of the units sold — sourced
          from each order item&apos;s real Purchase-batch cost, not the product&apos;s current purchase price.
        </p>
        {isProfitLoading ? (
          <div className="h-32 animate-pulse rounded-lg bg-cream-200" />
        ) : profitSeries.length === 0 ? (
          <p className="text-sm text-brown-500">No sales in this range.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-brown-600/10 text-xs uppercase tracking-wide text-brown-500">
                <th className="py-2">Period</th>
                <th className="py-2">Net Revenue</th>
                <th className="py-2">Cost of Goods Sold</th>
                <th className="py-2">Gross Profit</th>
                <th className="py-2">Orders</th>
              </tr>
            </thead>
            <tbody>
              {profitSeries.map((row) => (
                <tr key={row.period} className="border-b border-brown-600/10 last:border-none">
                  <td className="py-2 font-medium text-green-950">{row.period}</td>
                  <td className="py-2 text-brown-600">{formatBDT(row.netSellingRevenueBDT)}</td>
                  <td className="py-2 text-brown-600">{formatBDT(row.costOfGoodsSoldBDT)}</td>
                  <td className={`py-2 font-semibold ${row.grossProfitBDT >= 0 ? "text-green-900" : "text-danger"}`}>
                    {formatBDT(row.grossProfitBDT)}
                  </td>
                  <td className="py-2 text-brown-600">
                    {row.orders}
                    {row.ordersWithUnknownCostBasis > 0 && (
                      <span className="ml-1 text-[11px] text-gold-700" title="Order(s) with at least one item that had no purchase-batch cost history — this period's figure is a partial total.">
                        ({row.ordersWithUnknownCostBasis} est.)
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="rounded-xl border border-brown-600/10 bg-surface p-6">
        <h2 className="mb-1 flex items-center gap-2 font-serif text-lg text-green-950">
          <Warehouse size={18} className="text-green-900" /> Inventory Valuation
        </h2>
        <p className="mb-4 text-xs text-brown-500">
          Live stock valued at its actual landed cost from received purchase batches, not a guessed list price.
        </p>
        {isValuationLoading ? (
          <div className="h-32 animate-pulse rounded-lg bg-cream-200" />
        ) : !valuation || valuation.variants.length === 0 ? (
          <p className="text-sm text-brown-500">No stock on hand.</p>
        ) : (
          <>
            <div className="mb-4 rounded bg-brand-deep px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-on-brand/70">
                Total inventory value
              </p>
              <p className="font-serif text-2xl text-on-brand">{formatBDT(valuation.totalInventoryValueBDT)}</p>
            </div>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-brown-600/10 text-xs uppercase tracking-wide text-brown-500">
                  <th className="py-2">Product</th>
                  <th className="py-2">Stock</th>
                  <th className="py-2">Avg. unit cost</th>
                  <th className="py-2">Value</th>
                </tr>
              </thead>
              <tbody>
                {valuation.variants.map((row) => (
                  <tr key={`${row.productId}-${row.variantId}`} className="border-b border-brown-600/10 last:border-none">
                    <td className="py-2 font-medium text-green-950">
                      {row.productName} <span className="text-brown-500">({row.variantLabel})</span>
                    </td>
                    <td className="py-2 text-brown-600">{row.stock}</td>
                    <td className="py-2 text-brown-600">{formatBDTPrecise(row.averageUnitCostBDT)}</td>
                    <td className="py-2 font-semibold text-green-950">{formatBDT(row.inventoryValueBDT)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}
