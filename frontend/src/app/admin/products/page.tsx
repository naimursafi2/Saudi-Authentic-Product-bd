"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Plus, Pencil, Trash2, Package } from "lucide-react";
import { listProducts, createProduct, updateProduct, deleteProduct } from "@/lib/api/products";
import { ApiClientError } from "@/lib/api/client";
import { useAuth } from "@/context/AuthContext";
import { useCategories } from "@/lib/hooks/useCategories";
import { formatBDT } from "@/lib/utils";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState, TableSkeleton, ErrorState } from "@/components/admin/EmptyState";
import { Modal } from "@/components/admin/Modal";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { Button } from "@/components/ui/Button";
import { ProductForm, type ProductFormValues } from "@/components/admin/ProductForm";
import type { ApiProduct } from "@/types/api";
import type { Pagination } from "@/types/api";

export default function AdminProductsPage() {
  const { user } = useAuth();
  const { categories } = useCategories();
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ApiProduct | "new" | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingNotice, setPendingNotice] = useState<string | null>(null);

  // Per ROLES_AND_PERMISSIONS_v2.md §6: only super_admin deletes directly,
  // co_admin can only request deletion (approval-gated), admin has no
  // product-deletion access at all.
  const canDeleteDirectly = user?.role === "super_admin";
  const canRequestDelete = user?.role === "co_admin";

  function load() {
    setIsLoading(true);
    listProducts({ page, limit: 20 })
      .then(({ data, pagination: pg }) => {
        setProducts(data.products);
        setPagination(pg ?? null);
        setError(null);
      })
      .catch(() => setError("Could not load products."))
      .finally(() => setIsLoading(false));
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(load, [page]);

  async function handleSubmit(values: ProductFormValues, images: File[]) {
    setFormError(null);
    setIsSubmitting(true);
    try {
      const form = new FormData();
      form.set("name", values.name);
      form.set("tagline", values.tagline);
      form.set("description", values.description);
      form.set("origin", values.origin);
      form.set("categories", JSON.stringify(values.categories));
      form.set("variants", JSON.stringify(values.variants));
      form.set("highlights", JSON.stringify(values.highlights));
      if (values.badge) form.set("badge", values.badge);
      if (values.storageInstructions) form.set("storageInstructions", values.storageInstructions);
      form.set("isBestSeller", String(values.isBestSeller));
      form.set("isFeatured", String(values.isFeatured));
      images.forEach((file) => form.append("images", file));

      if (editing === "new") {
        await createProduct(form);
      } else if (editing) {
        await updateProduct(editing._id, form);
      }
      setEditing(null);
      load();
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.message : "Could not save product.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(product: ApiProduct) {
    const confirmMessage = canRequestDelete
      ? `Request deletion of "${product.name}"? This requires Super Admin approval.`
      : `Delete "${product.name}"? This cannot be undone.`;
    if (!confirm(confirmMessage)) return;

    const { data } = await deleteProduct(product._id);
    if (data?.pendingActionId) {
      setPendingNotice(`Deletion of "${product.name}" was submitted for Super Admin approval — see Approvals.`);
    }
    load();
  }

  return (
    <div>
      <PageHeader
        title="Products"
        description="Manage your catalog, variants, stock and photography."
        action={
          <Button variant="primary" size="sm" onClick={() => setEditing("new")}>
            <Plus size={14} /> Add Product
          </Button>
        }
      />

      {pendingNotice && (
        <div className="mb-4 rounded-lg border border-gold-500/40 bg-[#fcf8ee] p-4 text-sm text-[#735c00]">
          {pendingNotice}
        </div>
      )}

      {isLoading ? (
        <TableSkeleton />
      ) : error ? (
        <ErrorState message={error} />
      ) : products.length === 0 ? (
        <EmptyState icon={Package} title="No products yet" description="Add your first product to get started." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-brown-600/10 bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-brown-600/10 text-xs uppercase tracking-wide text-brown-500">
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Stock</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {products.map((product) => {
                const totalStock = product.variants.reduce((sum, v) => sum + v.stock, 0);
                return (
                  <tr key={product._id} className="border-b border-brown-600/10 last:border-none">
                    <td className="flex items-center gap-3 px-4 py-3">
                      <span className="relative size-10 shrink-0 overflow-hidden rounded bg-cream-300">
                        {product.images[0] && (
                          <Image src={product.images[0].url} alt={product.name} fill className="object-cover" />
                        )}
                      </span>
                      <span className="font-medium text-green-950">{product.name}</span>
                    </td>
                    <td className="px-4 py-3 text-brown-600">{formatBDT(product.minPriceBDT)}</td>
                    <td className="px-4 py-3 text-brown-600">{totalStock}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${
                          product.isActive ? "bg-[#e9f3ee] text-green-900" : "bg-cream-300 text-brown-500"
                        }`}
                      >
                        {product.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        aria-label="Edit"
                        onClick={() => setEditing(product)}
                        className="mr-3 text-brown-500 hover:text-green-950"
                      >
                        <Pencil size={15} />
                      </button>
                      {(canDeleteDirectly || canRequestDelete) && (
                        <button
                          aria-label={canDeleteDirectly ? "Delete" : "Request deletion"}
                          onClick={() => handleDelete(product)}
                          className="text-brown-500 hover:text-[#8a4a3f]"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <AdminPagination pagination={pagination} onPageChange={setPage} />

      {editing && (
        <Modal title={editing === "new" ? "Add Product" : "Edit Product"} onClose={() => setEditing(null)} wide>
          <ProductForm
            initial={editing === "new" ? undefined : editing}
            categories={categories}
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
