"use client";

import { useEffect, useState } from "react";
import { Clock, LogIn, LogOut as CheckOutIcon, ListChecks, Wallet } from "lucide-react";
import { getEmployeeDashboard } from "@/lib/api/reports";
import { checkIn, checkOut } from "@/lib/api/attendance";
import { ApiClientError } from "@/lib/api/client";
import { formatBDT } from "@/lib/utils";
import { PageHeader } from "@/components/admin/PageHeader";
import { TableSkeleton, ErrorState } from "@/components/admin/EmptyState";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Button } from "@/components/ui/Button";
import type { EmployeeDashboard } from "@/types/hr";

export default function EmployeeDashboardPage() {
  const [dashboard, setDashboard] = useState<EmployeeDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isActing, setIsActing] = useState(false);

  function load() {
    setIsLoading(true);
    getEmployeeDashboard()
      .then(({ data }) => {
        setDashboard(data.dashboard);
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

  return (
    <div>
      <PageHeader title="Dashboard" description="Your daily overview." />

      {isLoading ? (
        <TableSkeleton rows={3} />
      ) : error || !dashboard ? (
        <ErrorState message={error ?? "No data available."} />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="rounded-lg border border-brown-600/10 bg-white p-6 lg:col-span-1">
            <h2 className="mb-4 flex items-center gap-2 font-serif text-lg text-green-950">
              <Clock size={18} /> Today&apos;s Attendance
            </h2>
            {dashboard.todayAttendance ? (
              <div className="flex flex-col gap-2 text-sm text-brown-600">
                <p>
                  Status: <StatusBadge status={dashboard.todayAttendance.status} />
                </p>
                {dashboard.todayAttendance.checkIn && (
                  <p>Checked in: {new Date(dashboard.todayAttendance.checkIn).toLocaleTimeString()}</p>
                )}
                {dashboard.todayAttendance.checkOut && (
                  <p>Checked out: {new Date(dashboard.todayAttendance.checkOut).toLocaleTimeString()}</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-brown-500">You haven&apos;t checked in today.</p>
            )}
            {actionError && <p className="mt-2 text-sm text-[#8a4a3f]">{actionError}</p>}
            <div className="mt-4 flex gap-3">
              <Button
                variant="primary"
                size="sm"
                onClick={handleCheckIn}
                disabled={isActing || !!dashboard.todayAttendance?.checkIn}
              >
                <LogIn size={14} /> Check In
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCheckOut}
                disabled={isActing || !dashboard.todayAttendance?.checkIn || !!dashboard.todayAttendance?.checkOut}
              >
                <CheckOutIcon size={14} /> Check Out
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-brown-600/10 bg-white p-6">
            <h2 className="mb-4 flex items-center gap-2 font-serif text-lg text-green-950">
              <ListChecks size={18} /> Open Tasks
            </h2>
            <p className="text-3xl font-semibold text-green-950">{dashboard.pendingTaskCount}</p>
            <p className="text-sm text-brown-500">tasks not yet done</p>
          </div>

          <div className="rounded-lg border border-brown-600/10 bg-white p-6">
            <h2 className="mb-4 flex items-center gap-2 font-serif text-lg text-green-950">
              <Wallet size={18} /> Latest Salary Payment
            </h2>
            {dashboard.latestSalaryPayment ? (
              <div className="flex flex-col gap-1 text-sm text-brown-600">
                <p className="text-xl font-semibold text-green-950">
                  {formatBDT(dashboard.latestSalaryPayment.amountBDT)}
                </p>
                <p>
                  {new Date(dashboard.latestSalaryPayment.year, dashboard.latestSalaryPayment.month - 1).toLocaleString(
                    "en-US",
                    { month: "long", year: "numeric" }
                  )}
                </p>
                <StatusBadge status={dashboard.latestSalaryPayment.status} />
              </div>
            ) : (
              <p className="text-sm text-brown-500">No salary records yet.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
