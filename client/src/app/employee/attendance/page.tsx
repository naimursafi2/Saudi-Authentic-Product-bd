"use client";

import { useEffect, useState } from "react";
import { CalendarCheck, LogIn, LogOut } from "lucide-react";
import { listMyAttendance } from "@/lib/api/attendance";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState, TableSkeleton, ErrorState } from "@/components/admin/EmptyState";
import { StatusBadge } from "@/components/admin/StatusBadge";
import type { ApiAttendance } from "@/types/hr";

export default function EmployeeAttendancePage() {
  const [records, setRecords] = useState<ApiAttendance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true);
    listMyAttendance(1, 30)
      .then(({ data }) => {
        setRecords(data.records);
        setError(null);
      })
      .catch(() => setError("Could not load your attendance."))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div>
      <PageHeader title="Attendance" description="Your recent check-in / check-out history." />

      {isLoading ? (
        <TableSkeleton />
      ) : error ? (
        <ErrorState message={error} />
      ) : records.length === 0 ? (
        <EmptyState icon={CalendarCheck} title="No attendance records yet" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-brown-600/10 bg-surface shadow-[0_1px_2px_rgba(61,43,31,0.04)]">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-brown-600/10 bg-cream-200/40 text-xs uppercase tracking-wide text-brown-500">
                <th className="px-5 py-3.5">Date</th>
                <th className="px-5 py-3.5">Check In</th>
                <th className="px-5 py-3.5">Check Out</th>
                <th className="px-5 py-3.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r._id} className="border-b border-brown-600/10 transition-colors last:border-none hover:bg-cream-100/60">
                  <td className="px-5 py-3.5 font-medium text-green-950">
                    {new Date(r.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-5 py-3.5 text-brown-600">
                    {r.checkIn ? (
                      <span className="inline-flex items-center gap-1.5">
                        <LogIn size={13} className="text-green-900/60" />
                        {new Date(r.checkIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-brown-600">
                    {r.checkOut ? (
                      <span className="inline-flex items-center gap-1.5">
                        <LogOut size={13} className="text-brown-500/60" />
                        {new Date(r.checkOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusBadge status={r.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
