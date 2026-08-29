import { ExpenseModel, EXPENSE_CATEGORIES } from "../models/Expense.model";
import { OrderModel } from "../models/Order.model";
import {
  cogsContribution,
  dateBucketFormat,
  getSalesSummary,
  getSalesTimeSeries,
  revenueOrderMatch,
  type SalesGroupBy,
  type SalesSummaryFilter,
} from "./report.service";
import { getTotalInvestmentBDT } from "./investment.service";
import { getInventoryValuation } from "./inventory.service";

/** The Expense-side `$match` — confirmed spend only, dated by `incurredAt`.
 * Includes the `refund` category: an approved refund is booked as a confirmed
 * expense (`refund.service.ts#finalizeRefundApproval`), which is how money
 * returned to a customer reaches the P&L. */
function expenseMatch(filter: SalesSummaryFilter): Record<string, unknown> {
  const match: Record<string, unknown> = { status: "confirmed" };
  if (filter.from || filter.to) {
    const range: Record<string, Date> = {};
    if (filter.from) range.$gte = filter.from;
    if (filter.to) range.$lte = filter.to;
    match.incurredAt = range;
  }
  return match;
}

/**
 * Cost of goods sold for a date range, collapsed to one total — the same
 * frozen `unitLandedCostBDT × quantity` per order item that
 * `getGrossProfitTimeSeries` buckets by period, so the summary tile and the
 * period table can never disagree. `netSellingRevenueBDT` (subtotal minus
 * discount, excluding the shipping pass-through) comes back alongside it
 * because gross profit is only meaningful against that figure, not against
 * the shipping-inclusive top line.
 */
export async function getCostOfGoodsSold(filter: SalesSummaryFilter) {
  const [row] = await OrderModel.aggregate([
    { $match: revenueOrderMatch(filter) },
    {
      $addFields: {
        // `$ifNull` on every term: an order written before a field existed
        // stores nothing for it, and `$subtract` with a missing operand
        // evaluates to null, which `$sum` then skips — silently dropping that
        // whole order out of revenue instead of treating the gap as zero.
        netSellingRevenueBDT: {
          $subtract: [{ $ifNull: ["$subtotalBDT", 0] }, { $ifNull: ["$discountBDT", 0] }],
        },
        // Zeroed once the order's stock went back on the shelf — see
        // `cogsContribution`. The order still contributes its revenue.
        cogsBDT: cogsContribution({
          $sum: {
            $map: {
              input: "$items",
              as: "item",
              in: {
                $multiply: [
                  { $ifNull: ["$$item.unitLandedCostBDT", 0] },
                  { $ifNull: ["$$item.quantity", 0] },
                ],
              },
            },
          },
        }),
        hasUnknownCostBasis: cogsContribution({
          $anyElementTrue: {
            $map: { input: "$items", as: "item", in: { $eq: ["$$item.costBasisKnown", false] } },
          },
        }),
      },
    },
    {
      $group: {
        _id: null,
        netSellingRevenueBDT: { $sum: "$netSellingRevenueBDT" },
        costOfGoodsSoldBDT: { $sum: "$cogsBDT" },
        // Only orders that actually contribute cost can have an unknown one,
        // so a restocked order never gets flagged as a partial total.
        ordersWithUnknownCostBasis: {
          $sum: { $cond: [{ $eq: ["$hasUnknownCostBasis", true] }, 1, 0] },
        },
      },
    },
  ]);

  return {
    netSellingRevenueBDT: (row?.netSellingRevenueBDT as number) ?? 0,
    costOfGoodsSoldBDT: (row?.costOfGoodsSoldBDT as number) ?? 0,
    ordersWithUnknownCostBasis: (row?.ordersWithUnknownCostBasis as number) ?? 0,
  };
}

/**
 * The whole profit-and-loss picture for a date range, every figure derived
 * live from Orders, Purchases (through each sold item's frozen landed cost)
 * and confirmed Expenses — nothing stored, nothing estimated.
 *
 * Revenue is deliberately NOT re-derived here — `report.service.ts#getSalesSummary`
 * already computes it from live Order data, and duplicating that aggregation
 * would risk the two figures drifting apart.
 *
 * The P&L reads top to bottom as a real income statement:
 *
 *   net selling revenue  (subtotal − discount; shipping excluded as pass-through)
 *   − cost of goods sold (each sold unit's actual landed cost from its Purchase batch)
 *   = gross profit
 *   − operating expenses (confirmed Expense documents)
 *   = net profit / loss
 *
 * `netProfitBDT` therefore nets **both** the merchandise cost and operational
 * spend. Purchase batches are still never summed into `totalExpensesBDT`
 * directly: a batch is inventory until it sells, and only the portion that
 * actually sold enters the P&L, through COGS. That is what keeps stock
 * purchases from double-counting against manually-logged expenses while still
 * charging real product cost against profit.
 *
 * `ordersWithUnknownCostBasis` counts orders holding at least one item that
 * had no purchase-batch history at sale time, so a partial COGS figure can be
 * labelled as such rather than silently reading as "this sold at zero cost".
 *
 * ## Returns and refunds are counted exactly once
 *
 * A refunded or returned order is never recorded twice. The order keeps its
 * original revenue; what changes is:
 *
 * - **Cost of goods sold** drops to zero for it, because `unwindOrder` put the
 *   stock back and `getInventoryValuation()` now carries that cost instead.
 * - **The money returned** reaches the P&L once, as the confirmed `refund`
 *   expense that `finalizeRefundApproval` creates — not as a second deduction
 *   from revenue.
 *
 * Removing the revenue *and* booking the refund expense would charge the same
 * refund against profit twice; charging COGS on stock that is back on the
 * shelf would count the same cost twice. Neither happens.
 */
export async function getFinanceSummary(filter: SalesSummaryFilter) {
  const match = expenseMatch(filter);

  const [sales, cogs, totalInvestmentBDT, expenseTotals, byCategory] = await Promise.all([
    getSalesSummary(filter),
    getCostOfGoodsSold(filter),
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

  const grossProfitBDT = cogs.netSellingRevenueBDT - cogs.costOfGoodsSoldBDT;
  const netProfitBDT = grossProfitBDT - totalExpensesBDT;
  // Cash on hand, not profit: investment in, sales in, operating spend out.
  // Stock purchases are excluded on purpose — a received batch converts cash
  // into inventory, and `getInventoryValuation()` is where that value is
  // reported, so subtracting it here as well would understate the business
  // twice over.
  const cashBalanceBDT = totalInvestmentBDT + sales.totalRevenueBDT - totalExpensesBDT;

  return {
    totalRevenueBDT: sales.totalRevenueBDT,
    totalOrders: sales.totalOrders,
    netSellingRevenueBDT: cogs.netSellingRevenueBDT,
    costOfGoodsSoldBDT: cogs.costOfGoodsSoldBDT,
    grossProfitBDT,
    ordersWithUnknownCostBasis: cogs.ordersWithUnknownCostBasis,
    totalInvestmentBDT,
    totalExpensesBDT,
    netProfitBDT,
    cashBalanceBDT,
    expensesByCategory,
  };
}

/**
 * The full per-period P&L, bucketed by day/week/month — what the Finance
 * page's "Revenue vs Expense" table and the Analytics profit chart both read.
 *
 * All three sides (revenue, merchandise cost, operating expense) are grouped
 * on the same `dateBucketFormat`, then merged by period key rather than
 * assuming they produced the same set of periods — a period with expenses but
 * no orders, or sales but no expenses, still has to appear once with the
 * other sides at zero.
 *
 * `profitBDT` is the true bottom line for the period: net selling revenue
 * minus cost of goods sold minus operating expenses. It used to be revenue
 * minus expenses alone, which ignored what the goods actually cost and so
 * overstated profit by the whole merchandise cost.
 */
export async function getRevenueVsExpenseTimeSeries(filter: SalesSummaryFilter, groupBy: SalesGroupBy) {
  const [revenueRows, cogsRows, expenseRows] = await Promise.all([
    getSalesTimeSeries(filter, groupBy),
    getGrossProfitTimeSeries(filter, groupBy),
    ExpenseModel.aggregate([
      { $match: expenseMatch(filter) },
      {
        $group: {
          _id: { $dateToString: { format: dateBucketFormat(groupBy), date: "$incurredAt" } },
          expenseBDT: { $sum: "$amountBDT" },
        },
      },
    ]),
  ]);

  interface Row {
    period: string;
    revenueBDT: number;
    netSellingRevenueBDT: number;
    costOfGoodsSoldBDT: number;
    expenseBDT: number;
  }
  const byPeriod = new Map<string, Row>();
  const rowFor = (period: string): Row => {
    let row = byPeriod.get(period);
    if (!row) {
      row = { period, revenueBDT: 0, netSellingRevenueBDT: 0, costOfGoodsSoldBDT: 0, expenseBDT: 0 };
      byPeriod.set(period, row);
    }
    return row;
  };

  for (const row of revenueRows) rowFor(row.period).revenueBDT = row.revenueBDT;
  for (const row of cogsRows) {
    const target = rowFor(row.period);
    target.netSellingRevenueBDT = row.netSellingRevenueBDT;
    target.costOfGoodsSoldBDT = row.costOfGoodsSoldBDT;
  }
  for (const row of expenseRows) rowFor(row._id as string).expenseBDT = row.expenseBDT as number;

  return [...byPeriod.values()]
    .sort((a, b) => a.period.localeCompare(b.period))
    .map((row) => ({
      ...row,
      grossProfitBDT: row.netSellingRevenueBDT - row.costOfGoodsSoldBDT,
      profitBDT: row.netSellingRevenueBDT - row.costOfGoodsSoldBDT - row.expenseBDT,
    }));
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
  const rows = await OrderModel.aggregate([
    { $match: revenueOrderMatch(filter) },
    {
      $addFields: {
        // `$ifNull` on every term: an order written before a field existed
        // stores nothing for it, and `$subtract` with a missing operand
        // evaluates to null, which `$sum` then skips — silently dropping that
        // whole order out of revenue instead of treating the gap as zero.
        netSellingRevenueBDT: {
          $subtract: [{ $ifNull: ["$subtotalBDT", 0] }, { $ifNull: ["$discountBDT", 0] }],
        },
        cogsBDT: cogsContribution({
          $sum: {
            $map: {
              input: "$items",
              as: "item",
              in: {
                $multiply: [
                  { $ifNull: ["$$item.unitLandedCostBDT", 0] },
                  { $ifNull: ["$$item.quantity", 0] },
                ],
              },
            },
          },
        }),
        hasUnknownCostBasis: cogsContribution({
          $anyElementTrue: { $map: { input: "$items", as: "item", in: { $eq: ["$$item.costBasisKnown", false] } } },
        }),
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: dateBucketFormat(groupBy), date: "$createdAt" } },
        netSellingRevenueBDT: { $sum: "$netSellingRevenueBDT" },
        costOfGoodsSoldBDT: { $sum: "$cogsBDT" },
        orders: { $sum: 1 },
        ordersWithUnknownCostBasis: {
          $sum: { $cond: [{ $eq: ["$hasUnknownCostBasis", true] }, 1, 0] },
        },
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
