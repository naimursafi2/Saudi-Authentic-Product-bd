import { ExpenseModel, EXPENSE_CATEGORIES } from "../models/Expense.model";
import {
  dateBucketFormat,
  getSalesSummary,
  getSalesTimeSeries,
  type SalesGroupBy,
  type SalesSummaryFilter,
} from "./report.service";
import { getTotalInvestmentBDT } from "./investment.service";

/**
 * Revenue is deliberately NOT re-derived here — `report.service.ts#getSalesSummary`
 * already computes it from live Order data, and duplicating that aggregation
 * would risk the two figures drifting apart. This only adds the pieces that
 * don't already exist anywhere else: expenses, investment, and the profit/
 * loss and cash-balance figures derived from combining all three.
 */
export async function getFinanceSummary(filter: SalesSummaryFilter) {
  const match: Record<string, unknown> = { status: "confirmed" };
  if (filter.from || filter.to) {
    const range: Record<string, Date> = {};
    if (filter.from) range.$gte = filter.from;
    if (filter.to) range.$lte = filter.to;
    match.incurredAt = range;
  }

  const [sales, totalInvestmentBDT, expenseTotals, byCategory] = await Promise.all([
    getSalesSummary(filter),
    getTotalInvestmentBDT(),
    ExpenseModel.aggregate([{ $match: match }, { $group: { _id: null, total: { $sum: "$amountBDT" } } }]),
    ExpenseModel.aggregate([
      { $match: match },
      { $group: { _id: "$category", total: { $sum: "$amountBDT" } } },
    ]),
  ]);

  const totalExpensesBDT = expenseTotals[0]?.total ?? 0;
  const expensesByCategory = Object.fromEntries(EXPENSE_CATEGORIES.map((c) => [c, 0])) as Record<string, number>;
  for (const row of byCategory) {
    expensesByCategory[row._id as string] = row.total;
  }

  const netProfitBDT = sales.totalRevenueBDT - totalExpensesBDT;
  const cashBalanceBDT = totalInvestmentBDT + sales.totalRevenueBDT - totalExpensesBDT;

  return {
    totalRevenueBDT: sales.totalRevenueBDT,
    totalOrders: sales.totalOrders,
    totalInvestmentBDT,
    totalExpensesBDT,
    netProfitBDT,
    cashBalanceBDT,
    expensesByCategory,
  };
}

/**
 * Revenue-vs-Expense (and derived profit), bucketed by day/week/month — the
 * "Profit Report" and "Revenue vs Expense" analytics view. Revenue comes
 * from `getSalesTimeSeries` (never re-derived); the expense side is grouped
 * by the same date-bucket format so the two line up period-for-period, then
 * merged by period key rather than assuming both sides produced the same
 * set of periods (a period with expenses but no orders, or vice versa,
 * still needs to appear once with the other side at zero).
 */
export async function getRevenueVsExpenseTimeSeries(filter: SalesSummaryFilter, groupBy: SalesGroupBy) {
  const match: Record<string, unknown> = { status: "confirmed" };
  if (filter.from || filter.to) {
    const range: Record<string, Date> = {};
    if (filter.from) range.$gte = filter.from;
    if (filter.to) range.$lte = filter.to;
    match.incurredAt = range;
  }

  const [revenueRows, expenseRows] = await Promise.all([
    getSalesTimeSeries(filter, groupBy),
    ExpenseModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: dateBucketFormat(groupBy), date: "$incurredAt" } },
          expenseBDT: { $sum: "$amountBDT" },
        },
      },
    ]),
  ]);

  const byPeriod = new Map<string, { period: string; revenueBDT: number; expenseBDT: number }>();
  for (const row of revenueRows) {
    byPeriod.set(row.period, { period: row.period, revenueBDT: row.revenueBDT, expenseBDT: 0 });
  }
  for (const row of expenseRows) {
    const period = row._id as string;
    const existing = byPeriod.get(period);
    if (existing) existing.expenseBDT = row.expenseBDT as number;
    else byPeriod.set(period, { period, revenueBDT: 0, expenseBDT: row.expenseBDT as number });
  }

  return [...byPeriod.values()]
    .sort((a, b) => a.period.localeCompare(b.period))
    .map((row) => ({ ...row, profitBDT: row.revenueBDT - row.expenseBDT }));
}
