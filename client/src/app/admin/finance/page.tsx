"use client";

import { useEffect, useState } from "react";
import { Landmark, TrendingUp, TrendingDown, PiggyBank, Wallet, ShoppingBag } from "lucide-react";
import { getFinanceSummary } from "@/lib/api/finance";
import { useAuth } from "@/context/AuthContext";
import { formatBDT } from "@/lib/utils";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState, TableSkeleton, ErrorState } from "@/components/admin/EmptyState";
import type { FinanceSummary } from "@/types/api";

export default function AdminFinancePage() {
  const { hasPermission } = useAuth();
  const isRestricted = !hasPermission("finance.view");

  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    </div>
  );
}
