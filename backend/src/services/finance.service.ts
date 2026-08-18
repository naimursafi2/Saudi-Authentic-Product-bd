import { ExpenseModel, EXPENSE_CATEGORIES } from "../models/Expense.model";
import { getSalesSummary, type SalesSummaryFilter } from "./report.service";
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
