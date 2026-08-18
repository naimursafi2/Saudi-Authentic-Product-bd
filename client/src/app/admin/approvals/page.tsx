"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, Check, X, Settings2 } from "lucide-react";
import { denyPendingAction, grantPendingAction, listPendingActions } from "@/lib/api/pendingActions";
import { getApprovalSettings, updateApprovalSettings } from "@/lib/api/approvalSettings";
import { ApiClientError } from "@/lib/api/client";
import { useAuth } from "@/context/AuthContext";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState, TableSkeleton, ErrorState } from "@/components/admin/EmptyState";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Button } from "@/components/ui/Button";
import type { ApiApprovalSettings, ApiPendingAction, PendingActionStatus } from "@/types/api";

const fieldClasses =
  "w-full rounded border border-green-900/15 bg-cream-50 px-3 py-2 text-sm text-green-950 placeholder:text-brown-500/50 focus:border-green-900/40 focus:outline-none";
const labelClasses = "mb-1 block text-xs font-bold uppercase tracking-[0.06em] text-brown-600";

const ACTION_LABELS: Record<string, string> = {
  "coupon.create": "Create coupon",
  "coupon.update": "Update coupon",
  "product.delete": "Delete product",
  "refund.request": "Refund request",
  "refund.approve": "Refund approval",
  "expense.confirm": "Expense confirmation",
};

function personName(person: ApiPendingAction["requestedBy"]): string {
  return typeof person === "string" ? person : person.name;
}

function PayloadSummary({ action }: { action: ApiPendingAction }) {
  const p = action.payload;
  switch (action.actionType) {
    case "coupon.create":
    case "coupon.update":
      return (
        <span>
          {String(p.code ?? "")} — {String(p.discountValue ?? "")}
          {p.discountType === "percentage" ? "%" : " BDT"}
        </span>
      );
    case "product.delete":
      return <span>{String(p.productName ?? p.productId ?? "")}</span>;
    case "refund.request":
      return <span>{String(p.requestedAmountBDT ?? "")} BDT</span>;
    case "refund.approve":
      return <span>Refund #{String(p.refundId ?? "").slice(-6)}</span>;
    case "expense.confirm":
      return <span>Expense #{String(p.expenseId ?? "").slice(-6)}</span>;
    default:
      return <span>—</span>;
  }
}

export default function AdminApprovalsPage() {
  const { user } = useAuth();
  const isRestricted = user?.role !== "super_admin";

  const [actions, setActions] = useState<ApiPendingAction[]>([]);
  const [statusFilter, setStatusFilter] = useState<PendingActionStatus>("pending");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const [settings, setSettings] = useState<ApiApprovalSettings | null>(null);
  const [settingsForm, setSettingsForm] = useState<Record<string, string>>({});
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  function load() {
    setIsLoading(true);
    listPendingActions({ status: statusFilter, limit: 50 })
      .then(({ data }) => {
        setActions(data.actions);
        setError(null);
      })
      .catch(() => setError("Could not load pending actions."))
      .finally(() => setIsLoading(false));
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(load, [statusFilter]);

  useEffect(() => {
    getApprovalSettings().then(({ data }) => {
      setSettings(data.settings);
      setSettingsForm({
        couponAutoApprovePercent: String(data.settings.couponAutoApprovePercent),
        couponSuperAdminOnlyAbovePercent: String(data.settings.couponSuperAdminOnlyAbovePercent),
        refundAutoApproveThresholdBDT: String(data.settings.refundAutoApproveThresholdBDT),
        expenseApprovalThresholdBDT: String(data.settings.expenseApprovalThresholdBDT),
      });
    });
  }, []);

  async function handleGrant(action: ApiPendingAction) {
    const note = prompt("Note for this approval (optional):") ?? undefined;
    setActionError(null);
    setActingId(action._id);
    try {
      await grantPendingAction(action._id, note || undefined);
      load();
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.message : "Could not grant this request.");
    } finally {
      setActingId(null);
    }
  }

  async function handleDeny(action: ApiPendingAction) {
    const note = prompt("Reason for denying (optional):") ?? undefined;
    setActionError(null);
    setActingId(action._id);
    try {
      await denyPendingAction(action._id, note || undefined);
      load();
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.message : "Could not deny this request.");
    } finally {
      setActingId(null);
    }
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSettingsError(null);
    setIsSavingSettings(true);
    try {
      const { data } = await updateApprovalSettings({
        couponAutoApprovePercent: Number(settingsForm.couponAutoApprovePercent),
        couponSuperAdminOnlyAbovePercent: Number(settingsForm.couponSuperAdminOnlyAbovePercent),
        refundAutoApproveThresholdBDT: Number(settingsForm.refundAutoApproveThresholdBDT),
        expenseApprovalThresholdBDT: Number(settingsForm.expenseApprovalThresholdBDT),
      });
      setSettings(data.settings);
    } catch (err) {
      setSettingsError(err instanceof ApiClientError ? err.message : "Could not save thresholds.");
    } finally {
      setIsSavingSettings(false);
    }
  }

  if (isRestricted) {
    return (
      <div>
        <PageHeader title="Approvals" />
        <EmptyState
          icon={ShieldCheck}
          title="Access restricted"
          description="Approvals is available to Super Admin only."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      <div>
        <PageHeader
          title="Approval Thresholds"
          description="Super-Admin-editable — these numbers drive every gated action below."
        />
        {settings && (
          <form
            onSubmit={handleSaveSettings}
            className="grid grid-cols-1 gap-4 rounded-lg border border-brown-600/10 bg-white p-6 sm:grid-cols-2 lg:grid-cols-4"
          >
            <div>
              <label className={labelClasses}>Coupon Auto-Approve (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={settingsForm.couponAutoApprovePercent ?? ""}
                onChange={(e) => setSettingsForm((f) => ({ ...f, couponAutoApprovePercent: e.target.value }))}
                className={fieldClasses}
              />
            </div>
            <div>
              <label className={labelClasses}>Coupon Super-Admin-Only Above (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={settingsForm.couponSuperAdminOnlyAbovePercent ?? ""}
                onChange={(e) =>
                  setSettingsForm((f) => ({ ...f, couponSuperAdminOnlyAbovePercent: e.target.value }))
                }
                className={fieldClasses}
              />
            </div>
            <div>
              <label className={labelClasses}>Refund Auto-Approve (BDT)</label>
              <input
                type="number"
                min={0}
                value={settingsForm.refundAutoApproveThresholdBDT ?? ""}
                onChange={(e) => setSettingsForm((f) => ({ ...f, refundAutoApproveThresholdBDT: e.target.value }))}
                className={fieldClasses}
              />
            </div>
            <div>
              <label className={labelClasses}>Co-Admin Expense Approval (BDT)</label>
              <input
                type="number"
                min={0}
                value={settingsForm.expenseApprovalThresholdBDT ?? ""}
                onChange={(e) => setSettingsForm((f) => ({ ...f, expenseApprovalThresholdBDT: e.target.value }))}
                className={fieldClasses}
              />
            </div>
            {settingsError && <p className="text-sm text-[#8a4a3f] sm:col-span-2 lg:col-span-4">{settingsError}</p>}
            <div className="sm:col-span-2 lg:col-span-4">
              <Button type="submit" variant="primary" size="sm" disabled={isSavingSettings}>
                <Settings2 size={14} /> {isSavingSettings ? "Saving..." : "Save Thresholds"}
              </Button>
            </div>
          </form>
        )}
      </div>

      <div>
        <PageHeader title="Pending Requests" description="Grant or deny actions requested by Admin/Co-Admin." />

        <div className="mb-4 flex gap-2">
          {(["pending", "granted", "denied"] as PendingActionStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide ${
                statusFilter === s ? "bg-green-900 text-white" : "bg-cream-300 text-brown-600"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {actionError && <p className="mb-4 text-sm text-[#8a4a3f]">{actionError}</p>}

        {isLoading ? (
          <TableSkeleton />
        ) : error ? (
          <ErrorState message={error} />
        ) : actions.length === 0 ? (
          <EmptyState icon={ShieldCheck} title="Nothing here" description={`No ${statusFilter} requests.`} />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-brown-600/10 bg-white">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-brown-600/10 text-xs uppercase tracking-wide text-brown-500">
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Details</th>
                  <th className="px-4 py-3">Requested By</th>
                  <th className="px-4 py-3">Requested</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {actions.map((action) => (
                  <tr key={action._id} className="border-b border-brown-600/10 last:border-none">
                    <td className="px-4 py-3 font-medium text-green-950">
                      {ACTION_LABELS[action.actionType] ?? action.actionType}
                    </td>
                    <td className="px-4 py-3 text-brown-600">
                      <PayloadSummary action={action} />
                    </td>
                    <td className="px-4 py-3 text-brown-600">
                      {personName(action.requestedBy)}{" "}
                      <span className="text-xs capitalize text-brown-500">({action.requestedByRole})</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-brown-500">
                      {new Date(action.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={action.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      {action.status === "pending" && (
                        <div className="flex justify-end gap-2">
                          <button
                            aria-label="Grant"
                            disabled={actingId === action._id}
                            onClick={() => handleGrant(action)}
                            className="text-green-900 hover:text-green-950 disabled:opacity-50"
                          >
                            <Check size={16} />
                          </button>
                          <button
                            aria-label="Deny"
                            disabled={actingId === action._id}
                            onClick={() => handleDeny(action)}
                            className="text-[#8a4a3f] hover:text-[#6f3b32] disabled:opacity-50"
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
      </div>
    </div>
  );
}
