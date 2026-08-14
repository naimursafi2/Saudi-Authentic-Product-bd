import { OrderModel } from "../models/Order.model";
import { ProductModel } from "../models/Product.model";
import { UserModel } from "../models/User.model";
import { TaskModel } from "../models/Task.model";
import { AttendanceModel } from "../models/Attendance.model";
import { SalaryPaymentModel } from "../models/SalaryPayment.model";
import { getTodaySummary } from "./attendance.service";
import { countPendingLeaves } from "./leave.service";
import { countLowStockProducts } from "./inventory.service";

export interface SalesSummaryFilter {
  from?: Date;
  to?: Date;
}

export async function getSalesSummary(filter: SalesSummaryFilter) {
  const match: Record<string, unknown> = { status: { $ne: "cancelled" } };
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

/** Aggregate snapshot backing the Admin/Super Admin/Co-Admin dashboard. */
export async function getAdminDashboard() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [sales, pendingLeaves, lowStockCount, attendanceToday, totalCustomers, totalProducts, totalStaff] =
    await Promise.all([
      getSalesSummary({ from: thirtyDaysAgo }),
      countPendingLeaves(),
      countLowStockProducts(),
      getTodaySummary(),
      UserModel.countDocuments({ role: "customer" }),
      ProductModel.countDocuments({ isActive: true }),
      UserModel.countDocuments({ role: { $in: ["employee", "co_admin", "admin", "super_admin"] } }),
    ]);

  return { sales, pendingLeaves, lowStockCount, attendanceToday, totalCustomers, totalProducts, totalStaff };
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
