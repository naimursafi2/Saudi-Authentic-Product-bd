"use client";

import { useEffect, useState } from "react";
import { CalendarCheck, Pencil } from "lucide-react";
import { getTodaySummary, listAttendance, updateAttendance } from "@/lib/api/attendance";
import { ApiClientError } from "@/lib/api/client";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState, TableSkeleton, ErrorState } from "@/components/admin/EmptyState";
import { Modal } from "@/components/admin/Modal";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { Button } from "@/components/ui/Button";
import { Tooltip } from "@/components/ui/Tooltip";
import type { ApiAttendance, AttendanceStatus } from "@/types/hr";
import type { Pagination } from "@/types/api";

const STATUS_OPTIONS: AttendanceStatus[] = ["present", "late", "half_day", "absent", "leave"];

const fieldClasses =
  "w-full rounded border border-green-900/15 bg-cream-50 px-3 py-2 text-sm text-green-950 placeholder:text-brown-500/50 focus:border-green-900/40 focus:outline-none";
const labelClasses = "mb-1 block text-xs font-bold uppercase tracking-[0.06em] text-brown-600";

function employeeName(employee: ApiAttendance["employee"]) {
  return typeof employee === "string" ? employee : employee.name;
}

function formatTime(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

interface Summary {
  date: string;
  totalCheckedIn: number;
  present: number;
  late: number;
  half_day: number;
  absent: number;
  leave: number;
}

export default function AdminAttendancePage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [records, setRecords] = useState<ApiAttendance[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ApiAttendance | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function load() {
    setIsLoading(true);
    Promise.all([getTodaySummary(), listAttendance({ page, limit: 30 })])
      .then(([summaryRes, recordsRes]) => {
        setSummary(summaryRes.data.summary);
        setRecords(recordsRes.data.records);
        setPagination(recordsRes.pagination ?? null);
        setError(null);
      })
      .catch(() => setError("Could not load attendance."))
      .finally(() => setIsLoading(false));
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(load, [page]);

  async function handleSubmit(status: AttendanceStatus, note: string) {
    if (!editing) return;
    setFormError(null);
    setIsSubmitting(true);
    try {
      await updateAttendance(editing._id, { status, note: note || undefined });
      setEditing(null);
      load();
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.message : "Could not update attendance.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader title="Attendance" description="Today's check-ins and recent attendance records." />

      {summary && (
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Checked In" value={summary.totalCheckedIn} />
          <Stat label="Present" value={summary.present} />
          <Stat label="Late" value={summary.late} />
          <Stat label="Half Day" value={summary.half_day} />
          <Stat label="Absent" value={summary.absent} />
          <Stat label="On Leave" value={summary.leave} />
        </div>
      )}

      {isLoading ? (
        <TableSkeleton />
      ) : error ? (
        <ErrorState message={error} />
      ) : records.length === 0 ? (
        <EmptyState icon={CalendarCheck} title="No attendance records" description="Records will appear here once staff check in." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-brown-600/10 bg-surface">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-brown-600/10 text-xs uppercase tracking-wide text-brown-500">
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Check In</th>
                <th className="px-4 py-3">Check Out</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Note</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record._id} className="border-b border-brown-600/10 last:border-none">
                  <td className="px-4 py-3 font-medium text-green-950">{employeeName(record.employee)}</td>
                  <td className="px-4 py-3 text-brown-600">{new Date(record.date).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-brown-600">{formatTime(record.checkIn)}</td>
                  <td className="px-4 py-3 text-brown-600">{formatTime(record.checkOut)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={record.status} />
                  </td>
                  <td className="max-w-[200px] truncate px-4 py-3 text-brown-600">{record.note ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <Tooltip label="Edit">
                      <button
                        aria-label="Edit"
                        onClick={() => setEditing(record)}
                        className="inline-flex cursor-pointer items-center justify-center rounded-full bg-info-soft p-1.5 text-info transition-colors duration-150 hover:bg-info-soft-hover"
                      >
                        <Pencil size={15} />
                      </button>
                    </Tooltip>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AdminPagination pagination={pagination} onPageChange={setPage} />

      {editing && (
        <Modal title={`Edit Attendance — ${employeeName(editing.employee)}`} onClose={() => setEditing(null)}>
          <AttendanceEditForm
            record={editing}
            error={formError}
            isSubmitting={isSubmitting}
            onSubmit={handleSubmit}
            onCancel={() => setEditing(null)}
          />
        </Modal>
      )}
    </div>
  );
}

function AttendanceEditForm({
  record,
  error,
  isSubmitting,
  onSubmit,
  onCancel,
}: {
  record: ApiAttendance;
  error: string | null;
  isSubmitting: boolean;
  onSubmit: (status: AttendanceStatus, note: string) => void;
  onCancel: () => void;
}) {
  const [status, setStatus] = useState<AttendanceStatus>(record.status);
  const [note, setNote] = useState(record.note ?? "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(status, note);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div>
        <label className={labelClasses}>Status *</label>
        <select value={status} onChange={(e) => setStatus(e.target.value as AttendanceStatus)} className={fieldClasses}>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s.replace("_", " ")}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClasses}>Note</label>
        <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} className={fieldClasses} />
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex justify-end gap-3 border-t border-brown-600/10 pt-4">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" size="sm" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Save"}
        </Button>
      </div>
    </form>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded bg-cream-200 p-3 text-center">
      <span className="block text-lg font-semibold text-green-950">{value}</span>
      <span className="block text-[11px] uppercase tracking-wide text-brown-500">{label}</span>
    </div>
  );
}
