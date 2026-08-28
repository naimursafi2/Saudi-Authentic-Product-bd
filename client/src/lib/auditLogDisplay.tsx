import type { ApiAuditLog } from "@/types/api";

/**
 * Shared plain-language translation for `AuditLog` rows — used by
 * `/admin/audit-logs` (the full list) and the admin dashboard's "Recent
 * Activities" widget, so the same raw `action`/`resource` string always
 * reads the same way in both places. See CLAUDE.md's audit-logs section:
 * never render `log.action`/`log.resource` directly.
 */

export function actorName(actor: ApiAuditLog["actor"]): string {
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
  "return.request": "Return/Exchange Requested",
  "return.approve": "Return/Exchange Approved",
  "return.reject": "Return/Exchange Rejected",
  "expense.create": "Expense Recorded",
  "expense.confirm": "Expense Confirmed",
  "expense.reject": "Expense Rejected",
  "expense.edit": "Expense Edited",
  "expense.delete": "Expense Deleted",
  "investment.create": "Investment Recorded",
  "payment.initiated": "Payment Initiated",
  "payment.verified": "Payment Verified",
  "payment.cancelled": "Payment Cancelled",
  "payment.refunded": "Payment Refunded",
  "payment.verification.rejected": "Payment Verification Rejected",
  "role.create": "Role Created",
  "role.update": "Role Updated",
  "role.delete": "Role Deleted",
  "user.customRole.update": "Custom Role Assigned",
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
  "expense.edit": { request: "Expense Edit Requested", grant: "Expense Edit Approved", deny: "Expense Edit Request Denied", resource: "Expense" },
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

export function friendlyActionLabel(action: string): string {
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
  // Order matters — "payment.verification.rejected" must read as danger, not
  // as a success on the strength of the word "verification".
  if (/delete|reject|cancel|disable/i.test(action)) return "danger";
  if (/approve|confirm|unlock|enable|receive|verified/i.test(action)) return "success";
  if (/create|update|assign|start|initiated/i.test(action)) return "info";
  return "neutral";
}

const TONE_CLASSES: Record<Tone, string> = {
  success: "bg-success-soft text-green-900",
  danger: "bg-danger-soft text-danger",
  pending: "bg-gold-soft text-gold-700",
  info: "bg-info-soft text-info",
  neutral: "bg-cream-300 text-brown-600",
};

export function ActionBadge({ action }: { action: string }) {
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

const NAME_KEYS = ["name", "productName", "code", "roleName", "orderNumber"] as const;

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
export function resourceLabel(log: ApiAuditLog): { type: string; name?: string } {
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
export function DebugId({ id }: { id?: string }) {
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
export function friendlyNote(log: ApiAuditLog): string {
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
