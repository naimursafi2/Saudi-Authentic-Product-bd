"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { getInternalAsset } from "@/lib/api/internalAssets";
import { Modal } from "@/components/admin/Modal";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { TableSkeleton, ErrorState } from "@/components/admin/EmptyState";
import type { ApiInternalAsset, ApiInternalAssetEvent } from "@/types/api";

const EVENT_LABELS: Record<ApiInternalAssetEvent["action"], string> = {
  uploaded: "Uploaded",
  delete_requested: "Deletion requested",
  delete_rejected: "Deletion rejected",
  recycled: "Moved to Recycle Bin",
  restored: "Restored",
  purged: "Permanently deleted",
  purge_failed: "Permanent deletion failed",
};

function personName(person?: string | { _id: string; name: string; email: string }): string {
  if (!person) return "System";
  return typeof person === "string" ? person : person.name;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-brown-600/10 py-2 last:border-none">
      <span className="text-xs font-bold uppercase tracking-[0.06em] text-brown-500">{label}</span>
      <span className="text-right text-sm text-green-950">{value}</span>
    </div>
  );
}

/** Full provenance for one internal upload: where it is used, and its complete audit history. */
export function AssetDetailModal({ assetId, onClose }: { assetId: string; onClose: () => void }) {
  const [asset, setAsset] = useState<ApiInternalAsset | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getInternalAsset(assetId)
      .then(({ data }) => {
        if (!cancelled) setAsset(data.asset);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load this file's details.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [assetId]);

  return (
    <Modal title={asset?.fileName ?? "File details"} onClose={onClose} wide>
      {isLoading ? (
        <TableSkeleton rows={4} />
      ) : error || !asset ? (
        <ErrorState message={error ?? "File not found."} />
      ) : (
        <div className="flex flex-col gap-6">
          {asset.kind === "image" && asset.status !== "purged" && (
            <div className="relative h-48 w-full overflow-hidden rounded-lg border border-brown-600/10">
              <Image src={asset.url} alt={asset.fileName ?? "Upload"} fill className="object-contain" />
            </div>
          )}

          <div>
            <Row label="Status" value={<StatusBadge status={asset.status} />} />
            <Row label="Uploaded by" value={`${personName(asset.uploadedBy)} (${asset.uploadedByRole.replace(/_/g, " ")})`} />
            <Row label="Uploaded at" value={new Date(asset.createdAt).toLocaleString()} />
            <Row label="File type" value={asset.mimeType ?? asset.kind} />
            {asset.bytes !== undefined && (
              <Row label="Size" value={`${Math.round(asset.bytes / 1024)} KB`} />
            )}
            <Row label="Used in" value={asset.module ?? asset.resource} />
            {asset.fieldPath && <Row label="Field" value={asset.fieldPath} />}
            {asset.resourceId && (
              <Row label="Record" value={<span className="font-mono text-xs">{asset.resourceId}</span>} />
            )}
            {asset.deleteReason && <Row label="Delete reason" value={asset.deleteReason} />}
            {asset.reviewNote && <Row label="Review note" value={asset.reviewNote} />}
            {asset.purgeAfter && (
              <Row label="Scheduled deletion" value={new Date(asset.purgeAfter).toLocaleString()} />
            )}
            {asset.purgeError && <Row label="Last cleanup error" value={asset.purgeError} />}
          </div>

          <section>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-brown-500">History</h3>
            <ul className="flex flex-col gap-2">
              {asset.history.map((event, i) => (
                <li key={i} className="flex items-start justify-between gap-3 text-sm">
                  <span className="text-green-950">
                    {EVENT_LABELS[event.action]}
                    <span className="block text-xs text-brown-500">
                      {personName(event.by)}
                      {event.byRole ? ` (${event.byRole.replace(/_/g, " ")})` : ""}
                      {event.note ? ` — ${event.note}` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-brown-500">
                    {new Date(event.at).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </Modal>
  );
}
