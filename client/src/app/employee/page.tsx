"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  Clock,
  ListChecks,
  LogIn,
  LogOut as CheckOutIcon,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { getEmployeeDashboard } from "@/lib/api/reports";
import { checkIn, checkOut } from "@/lib/api/attendance";
import { listMyTasks } from "@/lib/api/tasks";
import { listMyLeaves } from "@/lib/api/leaves";
import { listMyPerformanceReviews } from "@/lib/api/performance";
import { ApiClientError } from "@/lib/api/client";
import { useAuth } from "@/context/AuthContext";
import { formatBDT, cn } from "@/lib/utils";
import { TableSkeleton, ErrorState } from "@/components/admin/EmptyState";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { StarRating } from "@/components/ui/StarRating";
import { Button } from "@/components/ui/Button";
import type { EmployeeDashboard, ApiTask, ApiLeaveRequest, ApiPerformanceReview } from "@/types/hr";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function EmployeeDashboardPage() {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState<EmployeeDashboard | null>(null);
  const [upcomingTasks, setUpcomingTasks] = useState<ApiTask[]>([]);
  const [leaves, setLeaves] = useState<ApiLeaveRequest[]>([]);
  const [latestReview, setLatestReview] = useState<ApiPerformanceReview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isActing, setIsActing] = useState(false);

  function load() {
    setIsLoading(true);
    Promise.all([
      getEmployeeDashboard(),
      listMyTasks(1, 5).catch(() => ({ data: { tasks: [] as ApiTask[] } })),
      listMyLeaves(1, 100).catch(() => ({ data: { leaves: [] as ApiLeaveRequest[] } })),
      listMyPerformanceReviews(1, 1).catch(() => ({ data: { reviews: [] as ApiPerformanceReview[] } })),
    ])
      .then(([dashboardRes, tasksRes, leavesRes, reviewsRes]) => {
        setDashboard(dashboardRes.data.dashboard);
        setUpcomingTasks(tasksRes.data.tasks);
        setLeaves(leavesRes.data.leaves);
        setLatestReview(reviewsRes.data.reviews[0] ?? null);
        setError(null);
      })
      .catch(() => setError("Could not load your dashboard."))
      .finally(() => setIsLoading(false));
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(load, []);

  async function handleCheckIn() {
    setActionError(null);
    setIsActing(true);
    try {
      await checkIn();
      load();
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.message : "Could not check in.");
    } finally {
      setIsActing(false);
    }
  }

  async function handleCheckOut() {
    setActionError(null);
    setIsActing(true);
    try {
      await checkOut();
      load();
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.message : "Could not check out.");
    } finally {
      setIsActing(false);
    }
  }

  if (isLoading) {
    return (
      <div>
        <div className="mb-6 h-28 w-full animate-pulse rounded-xl bg-surface" />
        <TableSkeleton rows={4} />
      </div>
    );
  }

  if (error || !dashboard) {
    return <ErrorState message={error ?? "No data available."} />;
  }

  const firstName = user?.name?.split(" ")[0] ?? "there";
  const pendingLeaveCount = leaves.filter((l) => l.status === "pending").length;
  const openTasks = upcomingTasks.filter((t) => t.status !== "done").slice(0, 3);
  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const statCards = [
    {
      href: "/employee/attendance",
      icon: Clock,
      label: "Today's Attendance",
      value: dashboard.todayAttendance ? dashboard.todayAttendance.status.replace("_", " ") : "Not checked in",
      capitalize: true,
    },
    {
      href: "/employee/tasks",
      icon: ListChecks,
      label: "Pending Tasks",
      value: String(dashboard.pendingTaskCount),
    },
    {
      href: "/employee/leave",
      icon: CalendarClock,
      label: "Pending Leave Requests",
      value: String(pendingLeaveCount),
    },
    {
      href: "/employee/salary",
      icon: Wallet,
      label: "Latest Salary",
      value: dashboard.latestSalaryPayment ? formatBDT(dashboard.latestSalaryPayment.amountBDT) : "—",
    },
    {
      href: "/employee/performance",
      icon: TrendingUp,
      label: "Performance Rating",
      value: latestReview ? `${latestReview.rating.toFixed(1)} / 5` : "—",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Welcome header */}
      <div className="flex flex-col gap-4 rounded-xl border border-brown-600/10 bg-surface p-6 shadow-[0_1px_2px_rgba(61,43,31,0.04)] sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-brown-500">{today}</p>
          <h1 className="mt-1 font-serif text-2xl text-green-950 sm:text-[28px]">
            {greeting()}, {firstName}
          </h1>
          <p className="mt-1 text-sm text-brown-600">Here&apos;s what&apos;s happening with your work today.</p>
        </div>
        <div className="flex items-center gap-3 rounded-lg bg-cream-200 px-4 py-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-deep text-base font-bold text-gold-500">
            {(user?.name ?? "E").charAt(0).toUpperCase()}
          </span>
          <span>
            <span className="block text-sm font-semibold text-green-950">
              {user?.staffMeta?.designation ?? "Employee"}
            </span>
            <span className="block text-xs text-brown-500">
              {user?.staffMeta?.employeeId ?? "—"}
              {user?.staffMeta?.department ? ` · ${user.staffMeta.department}` : ""}
            </span>
          </span>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {statCards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="flex flex-col gap-3 rounded-xl border border-brown-600/10 bg-surface p-4 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-green-950/5 text-green-900">
              <card.icon size={16} />
            </span>
            <span>
              <span className={cn("block text-lg font-semibold text-green-950", card.capitalize && "capitalize")}>
                {card.value}
              </span>
              <span className="block text-xs text-brown-500">{card.label}</span>
            </span>
          </Link>
        ))}
      </div>

      {/* Detail cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Attendance */}
        <div className="flex flex-col rounded-xl border border-brown-600/10 bg-surface p-6 shadow-[0_1px_2px_rgba(61,43,31,0.04)]">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-serif text-lg text-green-950">
              <CalendarCheck size={18} className="text-green-900" /> Today&apos;s Attendance
            </h2>
            {dashboard.todayAttendance && <StatusBadge status={dashboard.todayAttendance.status} />}
          </div>

          <div className="mb-4 grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-cream-200 p-3 text-center">
              <span className="block text-[11px] font-bold uppercase tracking-wide text-brown-500">Checked In</span>
              <span className="mt-1 block text-sm font-semibold text-green-950">
                {dashboard.todayAttendance?.checkIn
                  ? new Date(dashboard.todayAttendance.checkIn).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "—"}
              </span>
            </div>
            <div className="rounded-lg bg-cream-200 p-3 text-center">
              <span className="block text-[11px] font-bold uppercase tracking-wide text-brown-500">Checked Out</span>
              <span className="mt-1 block text-sm font-semibold text-green-950">
                {dashboard.todayAttendance?.checkOut
                  ? new Date(dashboard.todayAttendance.checkOut).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "—"}
              </span>
            </div>
          </div>

          {actionError && <p className="mb-3 text-sm text-danger">{actionError}</p>}

          <div className="mt-auto flex gap-3">
            <Button
              variant="primary"
              size="sm"
              onClick={handleCheckIn}
              disabled={isActing || !!dashboard.todayAttendance?.checkIn}
              className="flex-1"
            >
              <LogIn size={14} /> Check In
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCheckOut}
              disabled={isActing || !dashboard.todayAttendance?.checkIn || !!dashboard.todayAttendance?.checkOut}
              className="flex-1"
            >
              <CheckOutIcon size={14} /> Check Out
            </Button>
          </div>
        </div>

        {/* Open Tasks */}
        <div className="flex flex-col rounded-xl border border-brown-600/10 bg-surface p-6 shadow-[0_1px_2px_rgba(61,43,31,0.04)]">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-serif text-lg text-green-950">
              <ListChecks size={18} className="text-green-900" /> Open Tasks
            </h2>
            <span className="rounded-full bg-green-950/5 px-2.5 py-0.5 text-xs font-bold text-green-900">
              {dashboard.pendingTaskCount}
            </span>
          </div>

          {openTasks.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center">
              <CheckCircle2 size={26} className="text-green-900/40" />
              <p className="text-sm text-brown-500">You&apos;re all caught up.</p>
            </div>
          ) : (
            <ul className="flex flex-1 flex-col gap-3">
              {openTasks.map((task) => (
                <li key={task._id} className="rounded-lg border border-brown-600/10 p-3">
                  <p className="truncate text-sm font-semibold text-green-950">{task.title}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-brown-500">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 font-bold uppercase",
                        task.priority === "high"
                          ? "bg-danger-soft text-danger"
                          : task.priority === "medium"
                            ? "bg-gold-soft text-gold-700"
                            : "bg-cream-300 text-brown-600"
                      )}
                    >
                      {task.priority}
                    </span>
                    {task.dueDate && (
                      <span>Due {new Date(task.dueDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          <Link
            href="/employee/tasks"
            className="mt-4 flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.06em] text-green-900 hover:text-green-950"
          >
            View all tasks <ArrowRight size={12} />
          </Link>
        </div>

        {/* Latest Salary */}
        <div className="flex flex-col rounded-xl border border-brown-600/10 bg-surface p-6 shadow-[0_1px_2px_rgba(61,43,31,0.04)]">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-serif text-lg text-green-950">
              <Wallet size={18} className="text-green-900" /> Latest Salary
            </h2>
            {dashboard.latestSalaryPayment && <StatusBadge status={dashboard.latestSalaryPayment.status} />}
          </div>

          {dashboard.latestSalaryPayment ? (
            <div className="flex flex-1 flex-col justify-center gap-1">
              <p className="text-3xl font-semibold text-green-950">
                {formatBDT(dashboard.latestSalaryPayment.amountBDT)}
              </p>
              <p className="text-sm text-brown-500">
                {new Date(
                  dashboard.latestSalaryPayment.year,
                  dashboard.latestSalaryPayment.month - 1
                ).toLocaleString("en-US", { month: "long", year: "numeric" })}
              </p>
              {dashboard.latestSalaryPayment.paidAt && (
                <p className="text-xs text-brown-500">
                  Paid on {new Date(dashboard.latestSalaryPayment.paidAt).toLocaleDateString("en-GB")}
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center py-6">
              <p className="text-sm text-brown-500">No salary records yet.</p>
            </div>
          )}

          {latestReview && (
            <div className="mt-4 flex items-center justify-between border-t border-brown-600/10 pt-4">
              <span className="text-xs font-bold uppercase tracking-[0.06em] text-brown-500">Latest Review</span>
              <StarRating rating={latestReview.rating} size={13} showValue />
            </div>
          )}

          <Link
            href="/employee/salary"
            className="mt-4 flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.06em] text-green-900 hover:text-green-950"
          >
            View salary history <ArrowRight size={12} />
          </Link>
        </div>
      </div>
    </div>
  );
}
