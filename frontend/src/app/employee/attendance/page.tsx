"use client";

import { useEffect, useState } from "react";
import { CalendarCheck } from "lucide-react";
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
        <div className="overflow-x-auto rounded-lg border border-brown-600/10 bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-brown-600/10 text-xs uppercase tracking-wide text-brown-500">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Check In</th>
                <th className="px-4 py-3">Check Out</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r._id} className="border-b border-brown-600/10 last:border-none">
                  <td className="px-4 py-3 text-green-950">
                    {new Date(r.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-4 py-3 text-brown-600">
                    {r.checkIn ? new Date(r.checkIn).toLocaleTimeString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-brown-600">
                    {r.checkOut ? new Date(r.checkOut).toLocaleTimeString() : "—"}
                  </td>
                  <td className="px-4 py-3">
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
