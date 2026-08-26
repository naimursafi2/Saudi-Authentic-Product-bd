"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, PanelBottom, Pencil, Plus, Trash2 } from "lucide-react";
import {
  createFooterColumn,
  deleteFooterColumn,
  listFooterColumns,
  updateFooterColumn,
  type FooterColumnInput,
} from "@/lib/api/footerColumns";
import { ApiClientError } from "@/lib/api/client";
import { useAuth } from "@/context/AuthContext";
import { useConfirm } from "@/context/ConfirmDialogContext";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState, TableSkeleton, ErrorState } from "@/components/admin/EmptyState";
import { Modal } from "@/components/admin/Modal";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Button } from "@/components/ui/Button";
import { FooterColumnForm, type FooterColumnFormValues } from "@/components/admin/FooterColumnForm";
import type { ApiFooterColumn } from "@/types/api";

export default function AdminFooterPage() {
  const { hasPermission } = useAuth();
  const confirmDialog = useConfirm();
  const isRestricted = !hasPermission("content.navigation.manage");

  const [columns, setColumns] = useState<ApiFooterColumn[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ApiFooterColumn | "new" | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function load() {
    setIsLoading(true);
    listFooterColumns(true)
      .then(({ data }) => {
        setColumns(data.footerColumns);
        setError(null);
      })
      .catch(() => setError("Could not load footer columns."))
      .finally(() => setIsLoading(false));
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(load, []);

  async function handleSubmit(values: FooterColumnFormValues) {
    setFormError(null);
    setIsSubmitting(true);
    try {
      const input: FooterColumnInput = values;
      if (editing === "new") {
        await createFooterColumn(input);
      } else if (editing) {
        await updateFooterColumn(editing._id, input);
      }
      setEditing(null);
      load();
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.message : "Could not save footer column.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(column: ApiFooterColumn) {
    const ok = await confirmDialog({
      title: "Delete Footer Column",
      message: `Delete "${column.heading}"? This cannot be undone.`,
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    await deleteFooterColumn(column._id);
    load();
  }

  async function toggleVisibility(column: ApiFooterColumn) {
    await updateFooterColumn(column._id, { isVisible: !column.isVisible });
    load();
  }

  async function moveColumn(column: ApiFooterColumn, direction: "up" | "down") {
    const sorted = [...columns].sort((a, b) => a.sortOrder - b.sortOrder);
    const index = sorted.findIndex((c) => c._id === column._id);
    const swapWith = direction === "up" ? sorted[index - 1] : sorted[index + 1];
    if (!swapWith) return;
    await Promise.all([
      updateFooterColumn(column._id, { sortOrder: swapWith.sortOrder }),
      updateFooterColumn(swapWith._id, { sortOrder: column.sortOrder }),
    ]);
    load();
  }

  if (isRestricted) {
    return (
      <div>
        <PageHeader title="Footer" />
        <EmptyState
          icon={PanelBottom}
          title="Access restricted"
          description="Footer management is available to Admin and Super Admin only."
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Footer" description="Manage the storefront footer's link columns." />
        <TableSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <PageHeader title="Footer" description="Manage the storefront footer's link columns." />
        <ErrorState message={error} />
      </div>
    );
  }

  const sorted = [...columns].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div>
      <PageHeader
        title="Footer"
        description="Manage the storefront footer's link columns. Social links live under Settings."
        action={
          <Button variant="primary" size="sm" onClick={() => setEditing("new")}>
            <Plus size={14} /> Add Column
          </Button>
        }
      />

      {sorted.length === 0 ? (
        <EmptyState icon={PanelBottom} title="No footer columns yet" description="Add a column to populate the footer." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-brown-600/10 bg-surface">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-brown-600/10 text-xs uppercase tracking-wide text-brown-500">
                <th className="px-4 py-3">Heading</th>
                <th className="px-4 py-3">Links</th>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Visibility</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((column, i) => (
                <tr key={column._id} className="border-b border-brown-600/10 last:border-none">
                  <td className="px-4 py-3 font-medium text-green-950">{column.heading}</td>
                  <td className="max-w-xs truncate px-4 py-3 text-brown-600">
                    {column.links.map((l) => l.label).join(", ") || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        aria-label="Move up"
                        disabled={i === 0}
                        onClick={() => moveColumn(column, "up")}
                        className="cursor-pointer text-brown-500 hover:text-green-950 disabled:opacity-30"
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        aria-label="Move down"
                        disabled={i === sorted.length - 1}
                        onClick={() => moveColumn(column, "down")}
                        className="cursor-pointer text-brown-500 hover:text-green-950 disabled:opacity-30"
                      >
                        <ArrowDown size={14} />
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleVisibility(column)} className="cursor-pointer">
                      <StatusBadge status={column.isVisible ? "active" : "inactive"} />
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      aria-label="Edit"
                      onClick={() => setEditing(column)}
                      className="mr-3 cursor-pointer text-brown-500 hover:text-green-950"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      aria-label="Delete"
                      onClick={() => handleDelete(column)}
                      className="cursor-pointer text-brown-500 hover:text-danger"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <Modal
          title={editing === "new" ? "Add Footer Column" : "Edit Footer Column"}
          onClose={() => setEditing(null)}
          wide
        >
          <FooterColumnForm
            initial={editing === "new" ? undefined : editing}
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
