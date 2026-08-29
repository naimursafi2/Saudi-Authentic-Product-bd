"use client";

import { useEffect, useState } from "react";
import { FileStack, RotateCcw, Trash2 } from "lucide-react";
import {
  approveAssetDeletion,
  listInternalAssets,
  purgeAssetNow,
  rejectAssetDeletion,
  recycleAssetDirectly,
  restoreAsset,
} from "@/lib/api/internalAssets";
import { ApiClientError } from "@/lib/api/client";
import { useConfirm } from "@/context/ConfirmDialogContext";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState, TableSkeleton, ErrorState } from "@/components/admin/EmptyState";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { ActionButton, ActionButtonGroup } from "@/components/ui/ActionButton";
import { AssetDetailModal } from "@/components/admin/AssetDetailModal";
import type {
  ApiInternalAsset,
  InternalAssetKind,
  InternalAssetStatus,
  Pagination,
  Role,
} from "@/types/api";

/**
 * Super Admin's centralized view of every internal upload, plus the review
 * queue and the Recycle Bin. The three tabs are just status filters over the
 * one endpoint — there is no per-module logic here, so a new internal upload
 * type appears automatically without this page changing.
 */
const TABS: { id: "all" | InternalAssetStatus; label: string; status?: InternalAssetStatus }[] = [
  { id: "all", label: "All Uploads" },
  { id: "delete_requested", label: "Delete Requests", status: "delete_requested" },
  { id: "recycled", label: "Recycle Bin", status: "recycled" },
];

const ROLE_OPTIONS: Role[] = ["employee", "delivery_agent", "order_manager", "co_admin", "admin", "super_admin"];
const KIND_OPTIONS: InternalAssetKind[] = ["image", "document", "other"];

const selectClasses =
  "h-9 rounded border border-brown-600/20 bg-surface px-3 text-sm text-green-950 focus:outline-none focus:ring-1 focus:ring-green-900/30";

function personName(person: ApiInternalAsset["uploadedBy"]): string {
  return typeof person === "string" ? person : person.name;
}

/** Whole days left before the scheduler permanently deletes a recycled file. */
function daysLeft(purgeAfter?: string): number | null {
  if (!purgeAfter) return null;
  const ms = new Date(purgeAfter).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

export default function AdminUploadsPage() {
  const confirm = useConfirm();

  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("all");
  const [assets, setAssets] = useState<ApiInternalAsset[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [role, setRole] = useState<Role | "">("");
  const [kind, setKind] = useState<InternalAssetKind | "">("");
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);

  function load() {
    setIsLoading(true);
    listInternalAssets({
      status: TABS.find((t) => t.id === tab)?.status,
      role: role || undefined,
      kind: kind || undefined,
      search: search.trim() || undefined,
      page,
      limit: 20,
    })
      .then(({ data, pagination: pg }) => {
        setAssets(data.assets);
        setPagination(pg ?? null);
        setError(null);
      })
      .catch(() => setError("Could not load uploads."))
      .finally(() => setIsLoading(false));
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(load, [tab, page, role, kind, search]);

  async function run(id: string, fn: () => Promise<unknown>, failure: string) {
    setActionError(null);
    setActingId(id);
    try {
      await fn();
      load();
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.message : failure);
    } finally {
      setActingId(null);
    }
  }

  async function handlePurge(asset: ApiInternalAsset) {
    const ok = await confirm({
      title: "Permanently delete this file?",
      message:
        `"${asset.fileName ?? asset.publicId}" will be erased from Cloudinary and can never be restored. ` +
        "This skips the remaining Recycle Bin period and cannot be undone.",
      confirmLabel: "Delete Forever",
      tone: "danger",
    });
    if (!ok) return;
    await run(asset._id, () => purgeAssetNow(asset._id), "Could not permanently delete this file.");
  }

  async function handleRecycle(asset: ApiInternalAsset) {
    const ok = await confirm({
      title: "Move this file to the Recycle Bin?",
      message: `"${asset.fileName ?? asset.publicId}" will stop being active immediately. You can restore it from the Recycle Bin for a limited time.`,
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    await run(asset._id, () => recycleAssetDirectly(asset._id), "Could not move this file to the Recycle Bin.");
  }

  return (
    <div>
      <PageHeader
        title="Uploads & Recycle Bin"
        description="Every file uploaded by internal staff. Staff can request a deletion; only you can approve, restore or permanently delete one. Customer uploads are not included."
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id);
              setPage(1);
            }}
            className={cn(
              "cursor-pointer rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-[0.06em] transition-colors",
              tab === t.id ? "bg-brand-deep-2 text-white" : "bg-cream-300 text-brown-600 hover:bg-cream-400"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search file name"
          className={cn(selectClasses, "min-w-[180px]")}
        />
        <select
          value={role}
          onChange={(e) => {
            setRole(e.target.value as Role | "");
            setPage(1);
          }}
          className={selectClasses}
        >
          <option value="">All roles</option>
          {ROLE_OPTIONS.map((r) => (
            <option key={r} value={r}>
              {r.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <select
          value={kind}
          onChange={(e) => {
            setKind(e.target.value as InternalAssetKind | "");
            setPage(1);
          }}
          className={selectClasses}
        >
          <option value="">All file types</option>
          {KIND_OPTIONS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </div>

      {actionError && <p className="mb-4 text-sm text-danger">{actionError}</p>}

      {isLoading ? (
        <TableSkeleton />
      ) : error ? (
        <ErrorState message={error} />
      ) : assets.length === 0 ? (
        <EmptyState
          icon={FileStack}
          title="Nothing here"
          description="Files uploaded by employees, managers, co-admins and admins appear here."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-brown-600/10 bg-surface">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-brown-600/10 text-xs uppercase tracking-wide text-brown-500">
                <th className="px-4 py-3">File</th>
                <th className="px-4 py-3">Uploaded By</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Used In</th>
                <th className="px-4 py-3">Uploaded</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {assets.map((asset) => {
                const remaining = daysLeft(asset.purgeAfter);
                return (
                  <tr key={asset._id} className="border-b border-brown-600/10 last:border-none">
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setViewing(asset._id)}
                        className="cursor-pointer text-left font-medium text-green-950 hover:underline"
                      >
                        {asset.fileName ?? asset.publicId}
                      </button>
                      <span className="block text-xs text-brown-500">{asset.kind}</span>
                    </td>
                    <td className="px-4 py-3 text-brown-600">{personName(asset.uploadedBy)}</td>
                    <td className="px-4 py-3 capitalize text-brown-600">
                      {asset.uploadedByRole.replace(/_/g, " ")}
                    </td>
                    <td className="px-4 py-3 text-brown-600">
                      {asset.module ?? asset.resource}
                      {asset.fieldPath && (
                        <span className="block text-xs text-brown-500">{asset.fieldPath}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-brown-600">
                      {new Date(asset.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={asset.status} />
                      {asset.status === "recycled" && remaining !== null && (
                        <span className="mt-1 block text-xs text-brown-500">
                          {remaining} day{remaining === 1 ? "" : "s"} left
                        </span>
                      )}
                      {asset.purgeError && (
                        <span className="mt-1 block max-w-[200px] text-xs text-danger">
                          Cleanup failed ({asset.purgeAttempts}x) — will retry
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ActionButtonGroup>
                        {asset.status === "active" && (
                          <ActionButton
                            tone="danger"
                            disabled={actingId === asset._id}
                            onClick={() => handleRecycle(asset)}
                          >
                            <Trash2 size={13} /> Delete
                          </ActionButton>
                        )}
                        {asset.status === "delete_requested" && (
                          <>
                            <ActionButton
                              tone="success"
                              disabled={actingId === asset._id}
                              onClick={() =>
                                run(
                                  asset._id,
                                  () => approveAssetDeletion(asset._id),
                                  "Could not approve this request."
                                )
                              }
                            >
                              Approve
                            </ActionButton>
                            <ActionButton
                              tone="danger"
                              disabled={actingId === asset._id}
                              onClick={() =>
                                run(
                                  asset._id,
                                  () => rejectAssetDeletion(asset._id),
                                  "Could not reject this request."
                                )
                              }
                            >
                              Reject
                            </ActionButton>
                          </>
                        )}
                        {asset.status === "recycled" && (
                          <>
                            <ActionButton
                              tone="success"
                              disabled={actingId === asset._id}
                              onClick={() =>
                                run(asset._id, () => restoreAsset(asset._id), "Could not restore this file.")
                              }
                            >
                              <RotateCcw size={13} /> Restore
                            </ActionButton>
                            <ActionButton
                              tone="danger"
                              disabled={actingId === asset._id}
                              onClick={() => handlePurge(asset)}
                            >
                              <Trash2 size={13} /> Delete Forever
                            </ActionButton>
                          </>
                        )}
                      </ActionButtonGroup>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="px-4 pb-4">
            <AdminPagination pagination={pagination} onPageChange={setPage} />
          </div>
        </div>
      )}

      {viewing && <AssetDetailModal assetId={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}
