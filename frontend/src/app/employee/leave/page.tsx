"use client";

import { useEffect, useState } from "react";
import { CalendarClock, Plus } from "lucide-react";
import { createLeaveRequest, listMyLeaves, cancelLeaveRequest } from "@/lib/api/leaves";
import { ApiClientError } from "@/lib/api/client";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState, TableSkeleton, ErrorState } from "@/components/admin/EmptyState";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Modal } from "@/components/admin/Modal";
import { Button } from "@/components/ui/Button";
import type { ApiLeaveRequest, LeaveType } from "@/types/hr";

const LEAVE_TYPES: LeaveType[] = ["sick", "casual", "annual", "unpaid", "other"];
const fieldClasses =
  "w-full rounded border border-green-900/15 bg-cream-50 px-3 py-2 text-sm text-green-950 focus:border-green-900/40 focus:outline-none";
const labelClasses = "mb-1 block text-xs font-bold uppercase tracking-[0.06em] text-brown-600";

export default function EmployeeLeavePage() {
  const [leaves, setLeaves] = useState<ApiLeaveRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function load() {
    setIsLoading(true);
    listMyLeaves(1, 30)
      .then(({ data }) => {
        setLeaves(data.leaves);
        setError(null);
      })
      .catch(() => setError("Could not load your leave requests."))
      .finally(() => setIsLoading(false));
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(load, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    const form = new FormData(e.currentTarget);
    setIsSubmitting(true);
    try {
      await createLeaveRequest({
        type: String(form.get("type")) as LeaveType,
        startDate: String(form.get("startDate")),
        endDate: String(form.get("endDate")),
        reason: String(form.get("reason")),
      });
      setShowForm(false);
      load();
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.message : "Could not submit leave request.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCancel(id: string) {
    if (!confirm("Cancel this leave request?")) return;
    await cancelLeaveRequest(id);
    load();
  }

  return (
    <div>
      <PageHeader
        title="Leave"
        description="Request time off and track approval status."
        action={
          <Button variant="primary" size="sm" onClick={() => setShowForm(true)}>
            <Plus size={14} /> Request Leave
          </Button>
        }
      />

      {isLoading ? (
        <TableSkeleton />
      ) : error ? (
        <ErrorState message={error} />
      ) : leaves.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="No leave requests yet"
          description="Submit a request when you need time off."
          action={
            <Button variant="outline" size="sm" onClick={() => setShowForm(true)} className="mt-2">
              <Plus size={14} /> Request Leave
            </Button>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-brown-600/10 bg-white shadow-[0_1px_2px_rgba(61,43,31,0.04)]">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-brown-600/10 bg-cream-200/40 text-xs uppercase tracking-wide text-brown-500">
                <th className="px-5 py-3.5">Type</th>
                <th className="px-5 py-3.5">Dates</th>
                <th className="px-5 py-3.5">Reason</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5" />
              </tr>
            </thead>
            <tbody>
              {leaves.map((leave) => (
                <tr key={leave._id} className="border-b border-brown-600/10 transition-colors last:border-none hover:bg-cream-100/60">
                  <td className="px-5 py-3.5 capitalize font-medium text-green-950">{leave.type}</td>
                  <td className="px-5 py-3.5 text-brown-600">
                    {new Date(leave.startDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} –{" "}
                    {new Date(leave.endDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  </td>
                  <td className="max-w-xs truncate px-5 py-3.5 text-brown-600">{leave.reason}</td>
                  <td className="px-5 py-3.5">
                    <StatusBadge status={leave.status} />
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    {leave.status === "pending" && (
                      <button
                        onClick={() => handleCancel(leave._id)}
                        className="text-xs font-bold uppercase tracking-wide text-brown-500 transition-colors hover:text-[#8a4a3f]"
                      >
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <Modal title="Request Leave" onClose={() => setShowForm(false)}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className={labelClasses}>Type *</label>
              <select name="type" required className={fieldClasses} defaultValue="casual">
                {LEAVE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClasses}>Start Date *</label>
                <input required type="date" name="startDate" className={fieldClasses} />
              </div>
              <div>
                <label className={labelClasses}>End Date *</label>
                <input required type="date" name="endDate" className={fieldClasses} />
              </div>
            </div>
            <div>
              <label className={labelClasses}>Reason *</label>
              <textarea required name="reason" rows={3} className={fieldClasses} />
            </div>
            {formError && <p className="text-sm text-[#8a4a3f]">{formError}</p>}
            <div className="flex justify-end gap-3 border-t border-brown-600/10 pt-4">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" disabled={isSubmitting}>
                {isSubmitting ? "Submitting..." : "Submit Request"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
