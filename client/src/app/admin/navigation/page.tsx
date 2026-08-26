"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Compass, Pencil, Plus, Trash2 } from "lucide-react";
import {
  createNavLink,
  deleteNavLink,
  listNavLinks,
  updateNavLink,
  type NavLinkInput,
} from "@/lib/api/navLinks";
import { ApiClientError } from "@/lib/api/client";
import { useAuth } from "@/context/AuthContext";
import { useConfirm } from "@/context/ConfirmDialogContext";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState, TableSkeleton, ErrorState } from "@/components/admin/EmptyState";
import { Modal } from "@/components/admin/Modal";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Button } from "@/components/ui/Button";
import { NavLinkForm, type NavLinkFormValues } from "@/components/admin/NavLinkForm";
import type { ApiNavLink } from "@/types/api";

export default function AdminNavigationPage() {
  const { hasPermission } = useAuth();
  const confirmDialog = useConfirm();
  const isRestricted = !hasPermission("content.navigation.manage");

  const [links, setLinks] = useState<ApiNavLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ApiNavLink | "new" | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function load() {
    setIsLoading(true);
    listNavLinks(true)
      .then(({ data }) => {
        setLinks(data.navLinks);
        setError(null);
      })
      .catch(() => setError("Could not load navigation links."))
      .finally(() => setIsLoading(false));
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(load, []);

  async function handleSubmit(values: NavLinkFormValues) {
    setFormError(null);
    setIsSubmitting(true);
    try {
      const input: NavLinkInput = values;
      if (editing === "new") {
        await createNavLink(input);
      } else if (editing) {
        await updateNavLink(editing._id, input);
      }
      setEditing(null);
      load();
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.message : "Could not save nav link.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(link: ApiNavLink) {
    const ok = await confirmDialog({
      title: "Delete Nav Link",
      message: `Delete "${link.label}"? This cannot be undone.`,
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    await deleteNavLink(link._id);
    load();
  }

  async function toggleVisibility(link: ApiNavLink) {
    await updateNavLink(link._id, { isVisible: !link.isVisible });
    load();
  }

  async function moveLink(link: ApiNavLink, direction: "up" | "down") {
    const sorted = [...links].sort((a, b) => a.sortOrder - b.sortOrder);
    const index = sorted.findIndex((l) => l._id === link._id);
    const swapWith = direction === "up" ? sorted[index - 1] : sorted[index + 1];
    if (!swapWith) return;
    await Promise.all([
      updateNavLink(link._id, { sortOrder: swapWith.sortOrder }),
      updateNavLink(swapWith._id, { sortOrder: link.sortOrder }),
    ]);
    load();
  }

  if (isRestricted) {
    return (
      <div>
        <PageHeader title="Navigation" />
        <EmptyState
          icon={Compass}
          title="Access restricted"
          description="Navigation management is available to Admin and Super Admin only."
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Navigation" description="Manage the storefront header's top-level nav links." />
        <TableSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <PageHeader title="Navigation" description="Manage the storefront header's top-level nav links." />
        <ErrorState message={error} />
      </div>
    );
  }

  const sorted = [...links].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div>
      <PageHeader
        title="Navigation"
        description="Manage the storefront header's top-level nav links. The Categories dropdown is always shown alongside these."
        action={
          <Button variant="primary" size="sm" onClick={() => setEditing("new")}>
            <Plus size={14} /> Add Link
          </Button>
        }
      />

      {sorted.length === 0 ? (
        <EmptyState icon={Compass} title="No nav links yet" description="Add a link to populate the header." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-brown-600/10 bg-surface">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-brown-600/10 text-xs uppercase tracking-wide text-brown-500">
                <th className="px-4 py-3">Label</th>
                <th className="px-4 py-3">Link</th>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Visibility</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((link, i) => (
                <tr key={link._id} className="border-b border-brown-600/10 last:border-none">
                  <td className="px-4 py-3 font-medium text-green-950">{link.label}</td>
                  <td className="px-4 py-3 text-brown-600">{link.href}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        aria-label="Move up"
                        disabled={i === 0}
                        onClick={() => moveLink(link, "up")}
                        className="cursor-pointer text-brown-500 hover:text-green-950 disabled:opacity-30"
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        aria-label="Move down"
                        disabled={i === sorted.length - 1}
                        onClick={() => moveLink(link, "down")}
                        className="cursor-pointer text-brown-500 hover:text-green-950 disabled:opacity-30"
                      >
                        <ArrowDown size={14} />
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleVisibility(link)} className="cursor-pointer">
                      <StatusBadge status={link.isVisible ? "active" : "inactive"} />
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      aria-label="Edit"
                      onClick={() => setEditing(link)}
                      className="mr-3 cursor-pointer text-brown-500 hover:text-green-950"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      aria-label="Delete"
                      onClick={() => handleDelete(link)}
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
        <Modal title={editing === "new" ? "Add Nav Link" : "Edit Nav Link"} onClose={() => setEditing(null)}>
          <NavLinkForm
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
