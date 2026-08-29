"use client";

import { useEffect, useState } from "react";
import { ExternalLink, FileStack, Trash2 } from "lucide-react";
import { listMyInternalAssets, requestAssetDeletion } from "@/lib/api/internalAssets";
import { ApiClientError } from "@/lib/api/client";
import { useConfirm } from "@/context/ConfirmDialogContext";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/admin/EmptyState";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { ActionButton, ActionButtonGroup } from "@/components/ui/ActionButton";
import type { ApiInternalAsset, Pagination } from "@/types/api";

/**
 * The staff view of the existing internal asset registry. The API deliberately
 * scopes this list to the signed-in uploader, so hiding rows in this component
 * is never relied on for access control.
 */
export function MyUploads() {
  const confirm = useConfirm();
  const [assets, setAssets] = useState<ApiInternalAsset[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    listMyInternalAssets({ page, limit: 20 })
      .then(({ data, pagination: pg }) => {
        setAssets(data.assets);
        setPagination(pg ?? null);
        setError(null);
      })
      .catch(() => setError("Could not load your uploads."))
      .finally(() => setLoading(false));
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(load, [page]);

  async function handleDelete(asset: ApiInternalAsset) {
    const ok = await confirm({
      title: "Request deletion of this file?",
      message: `"${asset.fileName ?? asset.publicId}" will remain active until a Super Admin approves the request.`,
      confirmLabel: "Request Delete",
      tone: "danger",
    });
    if (!ok) return;

    setActionError(null);
    setActingId(asset._id);
    try {
      await requestAssetDeletion(asset._id);
      load();
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.message : "Could not request deletion of this file.");
    } finally {
      setActingId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="My Uploads"
        description="Files you uploaded internally. Deleting a file sends a request to Super Admin; it stays active until approved."
      />

      {actionError && <p className="mb-4 text-sm text-danger">{actionError}</p>}

      {loading ? (
        <TableSkeleton />
      ) : error ? (
        <ErrorState message={error} />
      ) : assets.length === 0 ? (
        <EmptyState icon={FileStack} title="No uploads yet" description="Your internal uploads will appear here." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-brown-600/10 bg-surface">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-brown-600/10 text-xs uppercase tracking-wide text-brown-500">
                <th className="px-4 py-3">File</th>
                <th className="px-4 py-3">Used In</th>
                <th className="px-4 py-3">Uploaded</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {assets.map((asset) => (
                <tr key={asset._id} className="border-b border-brown-600/10 last:border-none">
                  <td className="px-4 py-3">
                    <span className="block font-medium text-green-950">{asset.fileName ?? asset.publicId}</span>
                    <span className="text-xs text-brown-500">{asset.kind}</span>
                  </td>
                  <td className="px-4 py-3 text-brown-600">{asset.module ?? asset.resource}</td>
                  <td className="px-4 py-3 text-brown-600">{new Date(asset.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3"><StatusBadge status={asset.status} /></td>
                  <td className="px-4 py-3 text-right">
                    <ActionButtonGroup>
                      <ActionButton tone="neutral" onClick={() => window.open(asset.url, "_blank", "noopener,noreferrer")}>
                        <ExternalLink size={13} /> View
                      </ActionButton>
                      {asset.status === "active" && (
                        <ActionButton tone="danger" disabled={actingId === asset._id} onClick={() => handleDelete(asset)}>
                          <Trash2 size={13} /> Delete
                        </ActionButton>
                      )}
                    </ActionButtonGroup>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 pb-4"><AdminPagination pagination={pagination} onPageChange={setPage} /></div>
        </div>
      )}
    </div>
  );
}
