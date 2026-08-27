"use client";

import { useEffect, useState } from "react";
import { ScrollText } from "lucide-react";
import { listAuditLogs } from "@/lib/api/auditLogs";
import { useAuth } from "@/context/AuthContext";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState, TableSkeleton, ErrorState } from "@/components/admin/EmptyState";
import { AdminPagination } from "@/components/admin/AdminPagination";
import type { ApiAuditLog, Pagination } from "@/types/api";

function actorName(actor: ApiAuditLog["actor"]): string {
  return typeof actor === "string" ? actor : actor.name;
}

/**
 * Every literal `action` string the backend's `recordAuditLog()` calls use
 * (see `server/src/services/*.service.ts`), mapped to a plain-language
 * label. Kept as one explicit dictionary rather than a clever parser —
 * the set is fixed and small enough that a reviewer can see exactly what
 * each raw action means, the same convention `PENDING_ACTION_TYPES` and
 * `ACTION_LABELS` on `/admin/approvals` already follow.
 */
const DIRECT_ACTION_LABELS: Record<string, string> = {
  "coupon.create": "Coupon Created",
  "coupon.update": "Coupon Updated",
  "coupon.delete": "Coupon Deleted",
  "product.create": "Product Created",
  "product.update": "Product Updated",
  "product.delete": "Product Deleted",
  "purchase.create": "Purchase Created",
  "purchase.update": "Purchase Updated",
  "purchase.cost.add": "Purchase Cost Added",
  "purchase.cost.update": "Purchase Cost Updated",
  "purchase.cost.remove": "Purchase Cost Removed",
  "purchase.receive": "Purchase Received",
  "purchase.cancel": "Purchase Cancelled",
  "purchase.delete": "Purchase Deleted",
  "refund.request": "Refund Requested",
  "refund.review": "Refund Reviewed",
  "refund.reject": "Refund Rejected",
  "refund.approve": "Refund Approved",
  "expense.create": "Expense Recorded",
  "expense.confirm": "Expense Confirmed",
  "expense.reject": "Expense Rejected",
  "investment.create": "Investment Recorded",
  "role.create": "Role Created",
  "role.update": "Role Updated",
  "role.delete": "Role Deleted",
  "user.customRole.update": "Custom Role Assigned",
  "shop.create": "Shop Created",
  "shop.update": "Shop Updated",
  "shop.delete": "Shop Deleted",
  "user.shops.assign": "Shop Assignment Updated",
  "siteSettings.logo.update": "Site Logo Updated",
  "approvalSettings.update": "Approval Settings Updated",
  "user.2fa.enable": "Two-Factor Authentication Enabled",
  "user.2fa.disable": "Two-Factor Authentication Disabled",
  "user.role.update": "User Role Updated",
  "user.status.update": "User Status Updated",
  "user.impersonate.start": "Support Login Started",
  "user.unlock": "Account Unlocked",
};

/**
 * The nine `PENDING_ACTION_TYPES` (see `server/src/models/PendingAction.model.ts`)
 * each also appear as `<type>.request` / `.grant` / `.deny` — a submission
 * routed through the Grant-Based Approval Workflow, and its outcome. Every
 * combination is spelled out explicitly rather than composed from
 * `DIRECT_ACTION_LABELS`, since "Refund Requested" (the direct action) reads
 * very differently from "Refund Request Submitted" (the gated one) even
 * though they share a verb.
 */
const GATED_ACTION_LABELS: Record<string, { request: string; grant: string; deny: string; resource: string }> = {
  "coupon.create": { request: "Coupon Creation Requested", grant: "Coupon Creation Approved", deny: "Coupon Creation Denied", resource: "Coupon" },
  "coupon.update": { request: "Coupon Update Requested", grant: "Coupon Update Approved", deny: "Coupon Update Denied", resource: "Coupon" },
  "product.create": { request: "Product Creation Requested", grant: "Product Creation Approved", deny: "Product Creation Denied", resource: "Product" },
  "product.delete": { request: "Product Deletion Requested", grant: "Product Deletion Approved", deny: "Product Deletion Denied", resource: "Product" },
  "product.stock.update": { request: "Stock Update Request Submitted", grant: "Stock Update Approved", deny: "Stock Update Denied", resource: "Product" },
  "inventory.adjust": { request: "Stock Adjustment Request Submitted", grant: "Stock Adjustment Approved", deny: "Stock Adjustment Denied", resource: "Product" },
  "refund.request": { request: "Refund Request Submitted", grant: "Refund Request Approved", deny: "Refund Request Denied", resource: "Refund" },
  "refund.approve": { request: "Refund Approval Requested", grant: "Refund Approved", deny: "Refund Approval Denied", resource: "Refund" },
  "expense.confirm": { request: "Expense Confirmation Requested", grant: "Expense Confirmed", deny: "Expense Confirmation Denied", resource: "Expense" },
  "purchase.receive": { request: "Purchase Receipt Requested", grant: "Purchase Received", deny: "Purchase Receipt Denied", resource: "Purchase" },
};

const GATE_SUFFIXES = ["request", "grant", "deny"] as const;
type GateSuffix = (typeof GATE_SUFFIXES)[number];

/** Splits e.g. "product.stock.update.grant" into its base actionType and suffix. */
function splitGatedAction(action: string): { base: string; suffix: GateSuffix } | null {
  for (const suffix of GATE_SUFFIXES) {
    if (action.endsWith(`.${suffix}`)) {
      return { base: action.slice(0, -(suffix.length + 1)), suffix };
    }
  }
  return null;
}

function humanizeFallback(action: string): string {
  return action
    .split(".")
    .join(" ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function friendlyActionLabel(action: string): string {
  const gated = splitGatedAction(action);
  if (gated && GATED_ACTION_LABELS[gated.base]) {
    return GATED_ACTION_LABELS[gated.base][gated.suffix];
  }
  return DIRECT_ACTION_LABELS[action] ?? humanizeFallback(action);
}

type Tone = "success" | "danger" | "pending" | "info" | "neutral";

function actionTone(action: string): Tone {
  const gated = splitGatedAction(action);
  if (gated) {
    if (gated.suffix === "grant") return "success";
    if (gated.suffix === "deny") return "danger";
    return "pending";
  }
  if (/delete|reject|cancel|disable/i.test(action)) return "danger";
  if (/approve|confirm|unlock|enable|receive/i.test(action)) return "success";
  if (/create|update|assign|start/i.test(action)) return "info";
  return "neutral";
}

const TONE_CLASSES: Record<Tone, string> = {
  success: "bg-success-soft text-green-900",
  danger: "bg-danger-soft text-danger",
  pending: "bg-gold-soft text-gold-700",
  info: "bg-info-soft text-info",
  neutral: "bg-cream-300 text-brown-600",
};

function ActionBadge({ action }: { action: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.06em] ${TONE_CLASSES[actionTone(action)]}`}
    >
      {friendlyActionLabel(action)}
    </span>
  );
}

/** Prettifies a raw Mongoose model name for display: "SiteSettings" -> "Site Settings". */
function humanizeResourceWord(resource: string): string {
  return resource.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
}

const NAME_KEYS = ["name", "productName", "code", "roleName"] as const;

function extractName(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  for (const key of NAME_KEYS) {
    const candidate = record[key];
    if (typeof candidate === "string" && candidate.trim()) return candidate;
  }
  return undefined;
}

/**
 * A meaningful label for the Resource column — the product/coupon/shop/user
 * name whenever the audit entry's `oldValue`/`newValue` carries one (most
 * do; see the `recordAuditLog()` call sites), falling back to just the
 * resource type. `PendingAction` rows are re-labelled to the *underlying*
 * resource (a grant's `newValue.resource`, or inferred from the gated
 * actionType for request/deny rows) so "PendingAction" itself never shows.
 */
function resourceLabel(log: ApiAuditLog): { type: string; name?: string } {
  const name = extractName(log.newValue) ?? extractName(log.oldValue);

  if (log.resource === "PendingAction") {
    const gated = splitGatedAction(log.action);
    const newVal = log.newValue as Record<string, unknown> | undefined;
    const resultResource = typeof newVal?.resource === "string" ? newVal.resource : undefined;
    const type = resultResource ?? (gated && GATED_ACTION_LABELS[gated.base]?.resource) ?? "Request";
    return { type, name };
  }

  return { type: humanizeResourceWord(log.resource), name };
}

/** A short, de-emphasized fragment of the raw id — present for anyone who
 * genuinely needs to trace a record, but never the headline of the cell. */
function DebugId({ id }: { id?: string }) {
  if (!id) return null;
  return (
    <span title={id} className="ml-1.5 font-mono text-[10px] text-brown-400">
      #{id.slice(-6)}
    </span>
  );
}

/** Falls back to a synthesized sentence for the handful of actions whose
 * `note` is usually empty but whose before/after values tell a clear story
 * on their own — everything else just shows the backend's own `note`. */
function friendlyNote(log: ApiAuditLog): string {
  if (log.note) return log.note;

  const oldVal = log.oldValue as Record<string, unknown> | undefined;
  const newVal = log.newValue as Record<string, unknown> | undefined;

  if (log.action === "user.role.update" && oldVal && newVal) {
    return `Role changed from ${String(oldVal.role)} to ${String(newVal.role)}.`;
  }
  if (log.action === "user.status.update" && newVal) {
    return newVal.isActive ? "Account reactivated." : "Account deactivated.";
  }
  if (log.action === "user.impersonate.start" && newVal?.targetEmail) {
    return `Signed in as ${String(newVal.targetEmail)}.`;
  }

  const gated = splitGatedAction(log.action);
  if (gated?.suffix === "grant") return "Approved and applied.";
  if (gated?.suffix === "deny") return "Denied — no change was applied.";
  if (gated?.suffix === "request") return "Submitted for Super Admin approval.";

  return "—";
}

export default function AdminAuditLogsPage() {
  const { user } = useAuth();
  const seesEveryone = user?.role === "admin" || user?.role === "super_admin";

  const [logs, setLogs] = useState<ApiAuditLog[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setIsLoading(true);
    listAuditLogs({ page, limit: 30 })
      .then(({ data, pagination: pg }) => {
        setLogs(data.logs);
        setPagination(pg ?? null);
        setError(null);
      })
      .catch(() => setError("Could not load audit logs."))
      .finally(() => setIsLoading(false));
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(load, [page]);

  return (
    <div>
      <PageHeader
        title="Audit Logs"
        description={
          seesEveryone
            ? "A plain-language history of sensitive actions across the platform."
            : "A plain-language history of your own actions."
        }
      />

      {isLoading ? (
        <TableSkeleton />
      ) : error ? (
        <ErrorState message={error} />
      ) : logs.length === 0 ? (
        <EmptyState icon={ScrollText} title="No activity yet" description="Sensitive actions will appear here." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-brown-600/10 bg-surface shadow-[0_1px_2px_rgba(61,43,31,0.04)]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-brown-600/10 bg-cream-200/40 text-xs uppercase tracking-wide text-brown-500">
                  <th className="px-5 py-3.5">Action</th>
                  <th className="px-5 py-3.5">Resource</th>
                  <th className="px-5 py-3.5">By</th>
                  <th className="px-5 py-3.5">Note</th>
                  <th className="px-5 py-3.5">When</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const resource = resourceLabel(log);
                  return (
                    <tr
                      key={log._id}
                      className="border-b border-brown-600/10 transition-colors last:border-none hover:bg-cream-100/60"
                    >
                      <td className="px-5 py-3.5">
                        <ActionBadge action={log.action} />
                      </td>
                      <td className="px-5 py-3.5 text-green-950">
                        <span className="font-medium">{resource.name ?? resource.type}</span>
                        {resource.name && <span className="ml-1.5 text-xs text-brown-500">({resource.type})</span>}
                        <DebugId id={log.resourceId} />
                      </td>
                      <td className="px-5 py-3.5 text-brown-600">
                        {actorName(log.actor)}{" "}
                        <span className="text-xs capitalize text-brown-500">({log.actorRole.replace(/_/g, " ")})</span>
                      </td>
                      <td className="max-w-xs px-5 py-3.5 text-brown-600">{friendlyNote(log)}</td>
                      <td className="px-5 py-3.5 text-xs whitespace-nowrap text-brown-500">
                        {new Date(log.createdAt).toLocaleString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-5 pb-4">
            <AdminPagination pagination={pagination} onPageChange={setPage} />
          </div>
        </div>
      )}
    </div>
  );
}
