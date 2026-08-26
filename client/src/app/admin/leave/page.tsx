"use client";

import { useEffect, useState } from "react";
import { CalendarClock, Check, X } from "lucide-react";
import { listLeaves, reviewLeaveRequest } from "@/lib/api/leaves";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState, TableSkeleton, ErrorState } from "@/components/admin/EmptyState";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { AdminPagination } from "@/components/admin/AdminPagination";
import type { ApiLeaveRequest, LeaveStatus } from "@/types/hr";
import type { Pagination } from "@/types/api";

const STATUS_FILTERS: { value: LeaveStatus | "all"; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "cancelled", label: "Cancelled" },
  { value: "all", label: "All" },
];

const fieldClasses =
  "rounded border border-green-900/15 bg-cream-50 px-3 py-2 text-sm text-green-950 focus:border-green-900/40 focus:outline-none";

function employeeName(employee: ApiLeaveRequest["employee"]) {
  return typeof employee === "string" ? employee : employee.name;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}

export default function AdminLeavePage() {
  const [statusFilter, setStatusFilter] = useState<LeaveStatus | "all">("pending");
  const [leaves, setLeaves] = useState<ApiLeaveRequest[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);

  function load() {
    setIsLoading(true);
    listLeaves({ status: statusFilter === "all" ? undefined : statusFilter, page, limit: 20 })
      .then(({ data, pagination: pg }) => {
        setLeaves(data.leaves);
        setPagination(pg ?? null);
        setError(null);
      })
      .catch(() => setError("Could not load leave requests."))
      .finally(() => setIsLoading(false));
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(load, [statusFilter, page]);

  async function handleApprove(leave: ApiLeaveRequest) {
    setActioningId(leave._id);
    try {
      await reviewLeaveRequest(leave._id, "approved");
      load();
    } finally {
      setActioningId(null);
    }
  }

  async function handleReject(leave: ApiLeaveRequest) {
    const note = window.prompt("Reason for rejection (optional):");
    // Cancelling the reason prompt must not reject the leave request anyway.
    if (note === null) return;
    setActioningId(leave._id);
    try {
      await reviewLeaveRequest(leave._id, "rejected", note || undefined);
      load();
    } finally {
      setActioningId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Leave Requests"
        description="Review and action staff leave requests."
        action={
          <select
            value={statusFilter}
            onChange={(e) => {
              setPage(1);
              setStatusFilter(e.target.value as LeaveStatus | "all");
            }}
            className={fieldClasses}
          >
            {STATUS_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        }
      />

      {isLoading ? (
        <TableSkeleton />
      ) : error ? (
        <ErrorState message={error} />
      ) : leaves.length === 0 ? (
        <EmptyState icon={CalendarClock} title="No leave requests" description="Leave requests will appear here." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-brown-600/10 bg-surface">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-brown-600/10 text-xs uppercase tracking-wide text-brown-500">
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Dates</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {leaves.map((leave) => (
                <tr key={leave._id} className="border-b border-brown-600/10 last:border-none">
                  <td className="px-4 py-3 font-medium text-green-950">{employeeName(leave.employee)}</td>
                  <td className="px-4 py-3 capitalize text-brown-600">{leave.type}</td>
                  <td className="px-4 py-3 text-brown-600">
                    {formatDate(leave.startDate)} – {formatDate(leave.endDate)}
                  </td>
                  <td className="max-w-[220px] truncate px-4 py-3 text-brown-600" title={leave.reason}>
                    {leave.reason}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={leave.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {leave.status === "pending" && (
                      <div className="flex justify-end gap-3">
                        <button
                          aria-label="Approve"
                          disabled={actioningId === leave._id}
                          onClick={() => handleApprove(leave)}
                          className="cursor-pointer text-green-900 hover:text-green-950 disabled:opacity-40"
                        >
                          <Check size={16} />
                        </button>
                        <button
                          aria-label="Reject"
                          disabled={actioningId === leave._id}
                          onClick={() => handleReject(leave)}
                          className="cursor-pointer text-danger hover:text-danger-strong disabled:opacity-40"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AdminPagination pagination={pagination} onPageChange={setPage} />
    </div>
  );
}
