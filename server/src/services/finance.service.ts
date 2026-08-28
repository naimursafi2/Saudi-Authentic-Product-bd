import { ExpenseModel, EXPENSE_CATEGORIES } from "../models/Expense.model";
import { OrderModel } from "../models/Order.model";
import {
  dateBucketFormat,
  getSalesSummary,
  getSalesTimeSeries,
  type SalesGroupBy,
  type SalesSummaryFilter,
} from "./report.service";
import { getTotalInvestmentBDT } from "./investment.service";
import { getInventoryValuation } from "./inventory.service";

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

/**
 * Gross profit, bucketed by day/week/month — the Purchase/Landed-Cost
 * system's own profit report, distinct from `getRevenueVsExpenseTimeSeries`
 * above (which nets *operational* Expense documents against total revenue).
 * This nets **cost of goods sold** — each sold item's frozen
 * `unitLandedCostBDT × quantity` (see `Order.model.ts`'s `IOrderItem`) —
 * against **net selling revenue** (subtotal minus discount, deliberately
 * excluding the shipping fee, which is logistics pass-through rather than
 * merchandise revenue). Same `status`/date-range match as
 * `report.service.ts#getSalesTimeSeries`, so the two line up period-for-
 * period; `ordersWithUnknownCostBasis` surfaces how many orders in each
 * bucket had at least one item whose cost fell back to "unknown" (no
 * purchase-batch history existed at sale time — see
 * `inventory.service.ts#consumeStockForSale`), so the figure can be shown as
 * a partial/estimated total rather than silently treating a missing cost as
 * zero.
 */
export async function getGrossProfitTimeSeries(filter: SalesSummaryFilter, groupBy: SalesGroupBy) {
  const match: Record<string, unknown> = { status: { $nin: ["cancelled", "refunded"] } };
  if (filter.from || filter.to) {
    const range: Record<string, Date> = {};
    if (filter.from) range.$gte = filter.from;
    if (filter.to) range.$lte = filter.to;
    match.createdAt = range;
  }

  const rows = await OrderModel.aggregate([
    { $match: match },
    {
      $addFields: {
        netSellingRevenueBDT: { $subtract: ["$subtotalBDT", "$discountBDT"] },
        cogsBDT: {
          $sum: {
            $map: {
              input: "$items",
              as: "item",
              in: { $multiply: ["$$item.unitLandedCostBDT", "$$item.quantity"] },
            },
          },
        },
        hasUnknownCostBasis: { $anyElementTrue: { $map: { input: "$items", as: "item", in: { $eq: ["$$item.costBasisKnown", false] } } } },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: dateBucketFormat(groupBy), date: "$createdAt" } },
        netSellingRevenueBDT: { $sum: "$netSellingRevenueBDT" },
        costOfGoodsSoldBDT: { $sum: "$cogsBDT" },
        orders: { $sum: 1 },
        ordersWithUnknownCostBasis: { $sum: { $cond: ["$hasUnknownCostBasis", 1, 0] } },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return rows.map((r) => ({
    period: r._id as string,
    netSellingRevenueBDT: r.netSellingRevenueBDT as number,
    costOfGoodsSoldBDT: r.costOfGoodsSoldBDT as number,
    grossProfitBDT: (r.netSellingRevenueBDT as number) - (r.costOfGoodsSoldBDT as number),
    orders: r.orders as number,
    ordersWithUnknownCostBasis: r.ordersWithUnknownCostBasis as number,
  }));
}

/**
 * Live stock valued at its actual landed cost — re-exported here (rather
 * than only from `inventory.service.ts`) so `/finance` is where a viewer
 * with `finance.view` looks for "what is the stock on the shelf actually
 * worth," alongside the rest of the module's financial-value reporting.
 */
export { getInventoryValuation };
