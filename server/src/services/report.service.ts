import { OrderModel } from "../models/Order.model";
import { ProductModel } from "../models/Product.model";
import { UserModel } from "../models/User.model";
import { TaskModel } from "../models/Task.model";
import { AttendanceModel } from "../models/Attendance.model";
import { SalaryPaymentModel } from "../models/SalaryPayment.model";
import { getTodaySummary } from "./attendance.service";
import { countPendingLeaves } from "./leave.service";
import { countLowStockProducts, countOutOfStockProducts } from "./inventory.service";
import { listAuditLogs } from "./auditLog.service";
import type { Role } from "../constants/roles";

export interface SalesSummaryFilter {
  from?: Date;
  to?: Date;
}

export async function getSalesSummary(filter: SalesSummaryFilter) {
  const match: Record<string, unknown> = { status: { $nin: ["cancelled", "refunded"] } };
  if (filter.from || filter.to) {
    const range: Record<string, Date> = {};
    if (filter.from) range.$gte = filter.from;
    if (filter.to) range.$lte = filter.to;
    match.createdAt = range;
  }

  const [totals] = await OrderModel.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalRevenueBDT: { $sum: "$totalBDT" },
        totalOrders: { $sum: 1 },
      },
    },
  ]);

  const byStatus = await OrderModel.aggregate([
    { $match: match },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);

  const topProducts = await OrderModel.aggregate([
    { $match: match },
    { $unwind: "$items" },
    {
      $group: {
        _id: "$items.product",
        name: { $first: "$items.productName" },
        quantitySold: { $sum: "$items.quantity" },
        revenueBDT: { $sum: "$items.lineTotalBDT" },
      },
    },
    { $sort: { quantitySold: -1 } },
    { $limit: 5 },
  ]);

  return {
    totalRevenueBDT: totals?.totalRevenueBDT ?? 0,
    totalOrders: totals?.totalOrders ?? 0,
    averageOrderValueBDT: totals?.totalOrders ? Math.round(totals.totalRevenueBDT / totals.totalOrders) : 0,
    ordersByStatus: Object.fromEntries(byStatus.map((s) => [s._id, s.count])),
    topProducts,
  };
}

/**
 * Aggregate snapshot backing the Admin/Super Admin/Co-Admin dashboard.
 * `viewer` threads through to `listAuditLogs` so a Co-Admin's "Recent
 * Activities" widget is force-scoped to their own actions exactly like the
 * full `/admin/audit-logs` page already is — not a separate rule to keep in
 * sync.
 */
export async function getAdminDashboard(viewer: { id: string; role: Role }) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [
    sales,
    pendingLeaves,
    lowStockCount,
    outOfStockCount,
    attendanceToday,
    totalCustomers,
    totalProducts,
    totalStaff,
    recentOrders,
    recentActivities,
  ] = await Promise.all([
    getSalesSummary({ from: thirtyDaysAgo }),
    countPendingLeaves(),
    countLowStockProducts(),
    countOutOfStockProducts(),
    getTodaySummary(),
    UserModel.countDocuments({ role: "customer" }),
    ProductModel.countDocuments({ isActive: true }),
    UserModel.countDocuments({
      role: { $in: ["employee", "delivery_agent", "co_admin", "order_manager", "admin", "super_admin"] },
    }),
    getRecentOrders(5),
    listAuditLogs({ page: 1, limit: 5 }, viewer),
  ]);

  return {
    sales,
    pendingLeaves,
    lowStockCount,
    outOfStockCount,
    attendanceToday,
    totalCustomers,
    totalProducts,
    totalStaff,
    recentOrders,
    recentActivities: recentActivities.logs,
  };
}

export type SalesGroupBy = "day" | "week" | "month";

/** `$dateToString` format keyed by bucket size — ISO week for "week" so buckets never straddle a year boundary oddly. */
export function dateBucketFormat(groupBy: SalesGroupBy): string {
  if (groupBy === "day") return "%Y-%m-%d";
  if (groupBy === "week") return "%G-W%V";
  return "%Y-%m";
}

/**
 * Revenue/order-count time series, bucketed by day/week/month — backs both
 * the Admin Dashboard's analytics view and the Daily/Weekly/Monthly Sales
 * Report. Same `match` shape as `getSalesSummary`, just grouped by a date
 * bucket instead of collapsed to one total.
 */
export async function getSalesTimeSeries(filter: SalesSummaryFilter, groupBy: SalesGroupBy) {
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
      $group: {
        _id: { $dateToString: { format: dateBucketFormat(groupBy), date: "$createdAt" } },
        revenueBDT: { $sum: "$totalBDT" },
        orders: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return rows.map((r) => ({ period: r._id as string, revenueBDT: r.revenueBDT as number, orders: r.orders as number }));
}

/** Most recent orders, newest first — the Admin Dashboard's "Recent Orders" widget. */
export async function getRecentOrders(limit: number) {
  return OrderModel.find()
    .populate("customer", "name email")
    .sort({ createdAt: -1 })
    .limit(limit)
    .select("orderNumber customer totalBDT status createdAt");
}

/**
 * Per-delivery-agent stats: how many orders they've been assigned, how many
 * they actually delivered vs. failed, and the average time from being
 * assigned to marking an order delivered — all derived live from `Order`
 * (`assignedAgent`, `status`, and the existing `statusHistory` entries),
 * never a separately-tracked/denormalized number.
 */
export async function getDeliveryAgentPerformance() {
  const agents = await UserModel.find({ role: "delivery_agent" }).select("name email isActive");

  return Promise.all(
    agents.map(async (agent) => {
      const [assigned, delivered, failed, deliveredOrders] = await Promise.all([
        OrderModel.countDocuments({ assignedAgent: agent._id }),
        OrderModel.countDocuments({ assignedAgent: agent._id, status: "delivered" }),
        OrderModel.countDocuments({ assignedAgent: agent._id, status: "delivery_failed" }),
        OrderModel.find({ assignedAgent: agent._id, status: "delivered" }).select("statusHistory"),
      ]);

      let totalDeliveryMs = 0;
      let timedDeliveryCount = 0;
      for (const order of deliveredOrders) {
        const assignedAt = order.statusHistory.find((h) => h.status === "assigned_to_agent")?.at;
        const deliveredAt = [...order.statusHistory].reverse().find((h) => h.status === "delivered")?.at;
        if (assignedAt && deliveredAt) {
          totalDeliveryMs += deliveredAt.getTime() - assignedAt.getTime();
          timedDeliveryCount += 1;
        }
      }

      return {
        agentId: agent._id.toString(),
        name: agent.name,
        email: agent.email,
        isActive: agent.isActive,
        assignedCount: assigned,
        deliveredCount: delivered,
        failedCount: failed,
        successRate: assigned > 0 ? Math.round((delivered / assigned) * 1000) / 10 : null,
        averageDeliveryHours:
          timedDeliveryCount > 0
            ? Math.round((totalDeliveryMs / timedDeliveryCount / (1000 * 60 * 60)) * 10) / 10
            : null,
      };
    })
  );
}

/** Snapshot backing an individual employee's own dashboard. */
export async function getEmployeeDashboard(employeeId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [todayAttendance, pendingTaskCount, latestSalaryPayment] = await Promise.all([
    AttendanceModel.findOne({ employee: employeeId, date: today }),
    TaskModel.countDocuments({ assignedTo: employeeId, status: { $ne: "done" } }),
    SalaryPaymentModel.findOne({ employee: employeeId }).sort({ year: -1, month: -1 }),
  ]);

  return { todayAttendance, pendingTaskCount, latestSalaryPayment };
}
