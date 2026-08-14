/** Types mirroring the backend HR/inventory/reports domain (see backend/src/models). */

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

export interface ApiTask {
  _id: string;
  title: string;
  description?: string;
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

export interface SalesSummary {
  totalRevenueBDT: number;
  totalOrders: number;
  averageOrderValueBDT: number;
  ordersByStatus: Record<string, number>;
  topProducts: { _id: string; name: string; quantitySold: number; revenueBDT: number }[];
}

export interface AdminDashboard {
  sales: SalesSummary;
  pendingLeaves: number;
  lowStockCount: number;
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
}

export interface EmployeeDashboard {
  todayAttendance: ApiAttendance | null;
  pendingTaskCount: number;
  latestSalaryPayment: ApiSalaryPayment | null;
}
