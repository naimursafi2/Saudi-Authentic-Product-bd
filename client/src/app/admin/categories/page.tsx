"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Plus, Pencil, Trash2, FolderTree } from "lucide-react";
import { listCategories, createCategory, updateCategory, deleteCategory } from "@/lib/api/categories";
import { ApiClientError } from "@/lib/api/client";
import { useAuth } from "@/context/AuthContext";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState, TableSkeleton, ErrorState } from "@/components/admin/EmptyState";
import { Modal } from "@/components/admin/Modal";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Button } from "@/components/ui/Button";
import { CategoryForm, type CategoryFormValues } from "@/components/admin/CategoryForm";
import type { ApiCategory } from "@/types/api";

export default function AdminCategoriesPage() {
  const { user } = useAuth();
  const canDelete = user?.role === "admin" || user?.role === "super_admin";

  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ApiCategory | "new" | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function load() {
    setIsLoading(true);
    listCategories(true)
      .then(({ data }) => {
        setCategories(data.categories);
        setError(null);
      })
      .catch(() => setError("Could not load categories."))
      .finally(() => setIsLoading(false));
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(load, []);

  async function handleSubmit(values: CategoryFormValues, image: File | null) {
    setFormError(null);
    setIsSubmitting(true);
    try {
      const form = new FormData();
      form.set("name", values.name);
      if (values.slug) form.set("slug", values.slug);
      if (values.description) form.set("description", values.description);
      form.set("sortOrder", String(values.sortOrder));
      form.set("isComingSoon", String(values.isComingSoon));
      if (image) form.set("image", image);

      if (editing === "new") {
        await createCategory(form);
      } else if (editing) {
        await updateCategory(editing._id, form);
      }
      setEditing(null);
      load();
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.message : "Could not save category.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(category: ApiCategory) {
    if (!confirm(`Delete "${category.name}"? This cannot be undone.`)) return;
    await deleteCategory(category._id);
    load();
  }

  return (
    <div>
      <PageHeader
        title="Categories"
        description="Organize your catalog into shoppable categories."
        action={
          <Button variant="primary" size="sm" onClick={() => setEditing("new")}>
            <Plus size={14} /> Add Category
          </Button>
        }
      />

      {isLoading ? (
        <TableSkeleton />
      ) : error ? (
        <ErrorState message={error} />
      ) : categories.length === 0 ? (
        <EmptyState icon={FolderTree} title="No categories yet" description="Add your first category to get started." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-brown-600/10 bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-brown-600/10 text-xs uppercase tracking-wide text-brown-500">
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Slug</th>
                <th className="px-4 py-3">Sort Order</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <tr key={category._id} className="border-b border-brown-600/10 last:border-none">
                  <td className="flex items-center gap-3 px-4 py-3">
                    <span className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded bg-cream-300 text-sm font-bold text-brown-500">
                      {category.image ? (
                        <Image src={category.image.url} alt={category.name} fill className="object-cover" />
                      ) : (
                        category.name.charAt(0).toUpperCase()
                      )}
                    </span>
                    <span className="font-medium text-green-950">{category.name}</span>
                  </td>
                  <td className="px-4 py-3 text-brown-600">{category.slug}</td>
                  <td className="px-4 py-3 text-brown-600">{category.sortOrder}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={category.isComingSoon ? "pending" : "active"} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      aria-label="Edit"
                      onClick={() => setEditing(category)}
                      className="mr-3 cursor-pointer text-brown-500 hover:text-green-950"
                    >
                      <Pencil size={15} />
                    </button>
                    {canDelete && (
                      <button
                        aria-label="Delete"
                        onClick={() => handleDelete(category)}
                        className="cursor-pointer text-brown-500 hover:text-[#8a4a3f]"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <Modal title={editing === "new" ? "Add Category" : "Edit Category"} onClose={() => setEditing(null)}>
          <CategoryForm
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
