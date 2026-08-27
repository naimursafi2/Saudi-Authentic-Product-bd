/** Types mirroring the backend HR/inventory/reports domain (see backend/src/models). */

import type { ApiAuditLog } from "./api";

export type AttendanceStatus = "present" | "late" | "half_day" | "absent" | "leave";

export interface ApiAttendance {
  _id: string;
  employee: string | { _id: string; name: string; email: string };
  date: string;
  checkIn?: string;
  checkOut?: string;
  status: AttendanceStatus;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export type LeaveType = "sick" | "casual" | "annual" | "unpaid" | "other";
export type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled";

export interface ApiLeaveRequest {
  _id: string;
  employee: string | { _id: string; name: string; email: string };
  type: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
  status: LeaveStatus;
  reviewedBy?: string;
  reviewNote?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type TaskPriority = "low" | "medium" | "high";
export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskType =
  | "packing"
  | "product_counting"
  | "stock_checking"
  | "warehouse"
  | "customer_support"
  | "data_entry"
  | "product_preparation";

export interface ApiTask {
  _id: string;
  title: string;
  description?: string;
  type: TaskType;
  assignedTo: string | { _id: string; name: string; email: string };
  assignedBy: string | { _id: string; name: string; email: string };
  dueDate?: string;
  priority: TaskPriority;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ApiPerformanceReview {
  _id: string;
  employee: string | { _id: string; name: string; email: string };
  reviewer: string | { _id: string; name: string };
  period: string;
  rating: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type SalaryPaymentStatus = "pending" | "paid";

export interface ApiSalaryPayment {
  _id: string;
  employee: string | { _id: string; name: string; email: string };
  month: number;
  year: number;
  amountBDT: number;
  dailyAllowanceBDT: number;
  status: SalaryPaymentStatus;
  paidAt?: string;
  note?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type InventoryLogReason = "order_placed" | "order_cancelled" | "manual_adjustment";

export interface ApiInventoryLog {
  _id: string;
  product: string | { _id: string; name: string; slug: string };
  variantId: string;
  variantLabel: string;
  delta: number;
  balanceAfter: number;
  reason: InventoryLogReason;
  note?: string;
  actor?: string | { _id: string; name: string };
  createdAt: string;
}

export interface LowStockEntry {
  product: {
    _id: string;
    name: string;
    slug: string;
    images: { url: string; publicId: string; isPrimary?: boolean }[];
  };
  lowStockVariants: { _id: string; label: string; stock: number; lowStockThreshold: number }[];
}

/** Distinct from `LowStockEntry` — only variants at exactly zero. */
export interface OutOfStockEntry {
  product: {
    _id: string;
    name: string;
    slug: string;
    images: { url: string; publicId: string; isPrimary?: boolean }[];
  };
  outOfStockVariants: { _id: string; label: string; stock: number; lowStockThreshold: number }[];
}

/** Read-only live stock snapshot from `GET /inventory/stock`. */
export interface StockLevelProduct {
  _id: string;
  name: string;
  slug: string;
  isActive: boolean;
  image?: string;
  totalStock: number;
  variants: { variantId: string; label: string; stock: number; lowStockThreshold: number }[];
}

export interface SalesSummary {
  totalRevenueBDT: number;
  totalOrders: number;
  averageOrderValueBDT: number;
  ordersByStatus: Record<string, number>;
  topProducts: { _id: string; name: string; quantitySold: number; revenueBDT: number }[];
}

export interface SalesTimeSeriesPoint {
  period: string;
  revenueBDT: number;
  orders: number;
}

export interface RevenueVsExpensePoint {
  period: string;
  revenueBDT: number;
  expenseBDT: number;
  profitBDT: number;
}

export interface DashboardRecentOrder {
  _id: string;
  orderNumber: string;
  customer: string | { _id: string; name: string; email: string };
  totalBDT: number;
  status: string;
  createdAt: string;
}

export interface AdminDashboard {
  sales: SalesSummary;
  pendingLeaves: number;
  lowStockCount: number;
  outOfStockCount: number;
  attendanceToday: {
    date: string;
    totalCheckedIn: number;
    present: number;
    late: number;
    half_day: number;
    absent: number;
    leave: number;
  };
  totalCustomers: number;
  totalProducts: number;
  totalStaff: number;
  recentOrders: DashboardRecentOrder[];
  recentActivities: ApiAuditLog[];
}

export interface EmployeeDashboard {
  todayAttendance: ApiAttendance | null;
  pendingTaskCount: number;
  latestSalaryPayment: ApiSalaryPayment | null;
}
