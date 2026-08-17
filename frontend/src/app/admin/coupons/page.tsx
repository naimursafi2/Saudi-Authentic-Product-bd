"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Tag } from "lucide-react";
import { listCoupons, createCoupon, updateCoupon, deleteCoupon, type CouponPayload } from "@/lib/api/coupons";
import { ApiClientError } from "@/lib/api/client";
import { useAuth } from "@/context/AuthContext";
import { formatBDT } from "@/lib/utils";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState, TableSkeleton, ErrorState } from "@/components/admin/EmptyState";
import { Modal } from "@/components/admin/Modal";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { Button } from "@/components/ui/Button";
import { CouponForm, type CouponFormValues } from "@/components/admin/CouponForm";
import type { ApiCoupon, Pagination } from "@/types/api";

function formatDiscount(coupon: ApiCoupon): string {
  return coupon.discountType === "percentage" ? `${coupon.discountValue}%` : formatBDT(coupon.discountValue);
}

export default function AdminCouponsPage() {
  const { user } = useAuth();
  const isRestricted = user?.role === "co_admin";
  const canManage = user?.role === "admin" || user?.role === "super_admin";

  const [coupons, setCoupons] = useState<ApiCoupon[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ApiCoupon | "new" | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function load() {
    setIsLoading(true);
    listCoupons({ page, limit: 20 })
      .then(({ data, pagination: pg }) => {
        setCoupons(data.coupons);
        setPagination(pg ?? null);
        setError(null);
      })
      .catch(() => setError("Could not load coupons."))
      .finally(() => setIsLoading(false));
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(load, [page]);

  async function handleSubmit(values: CouponFormValues) {
    setFormError(null);
    setIsSubmitting(true);
    try {
      const payload: CouponPayload = {
        code: values.code,
        description: values.description || undefined,
        discountType: values.discountType,
        discountValue: Number(values.discountValue),
        minOrderAmountBDT: values.minOrderAmountBDT ? Number(values.minOrderAmountBDT) : 0,
        startsAt: new Date(values.startsAt).toISOString(),
        expiresAt: new Date(values.expiresAt).toISOString(),
        usageLimit: values.usageLimit ? Number(values.usageLimit) : undefined,
        isActive: values.isActive,
      };

      if (editing === "new") {
        await createCoupon(payload);
      } else if (editing) {
        await updateCoupon(editing._id, payload);
      }
      setEditing(null);
      load();
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.message : "Could not save coupon.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(coupon: ApiCoupon) {
    if (!confirm(`Delete coupon "${coupon.code}"? This cannot be undone.`)) return;
    await deleteCoupon(coupon._id);
    load();
  }

  if (isRestricted) {
    return (
      <div>
        <PageHeader title="Coupons" />
        <EmptyState
          icon={Tag}
          title="Access restricted"
          description="Coupon management is available to Admin and Super Admin only."
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Coupons"
        description="Promo codes customers can apply at checkout."
        action={
          <Button variant="primary" size="sm" onClick={() => setEditing("new")}>
            <Plus size={14} /> Add Coupon
          </Button>
        }
      />

      {isLoading ? (
        <TableSkeleton />
      ) : error ? (
        <ErrorState message={error} />
      ) : coupons.length === 0 ? (
        <EmptyState icon={Tag} title="No coupons yet" description="Create your first coupon to get started." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-brown-600/10 bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-brown-600/10 text-xs uppercase tracking-wide text-brown-500">
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Discount</th>
                <th className="px-4 py-3">Min. Order</th>
                <th className="px-4 py-3">Usage</th>
                <th className="px-4 py-3">Window</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {coupons.map((coupon) => (
                <tr key={coupon._id} className="border-b border-brown-600/10 last:border-none">
                  <td className="px-4 py-3">
                    <span className="font-mono font-semibold text-green-950">{coupon.code}</span>
                    {coupon.description && <span className="block text-xs text-brown-500">{coupon.description}</span>}
                  </td>
                  <td className="px-4 py-3 text-brown-600">{formatDiscount(coupon)}</td>
                  <td className="px-4 py-3 text-brown-600">{formatBDT(coupon.minOrderAmountBDT)}</td>
                  <td className="px-4 py-3 text-brown-600">
                    {coupon.usageCount}
                    {coupon.usageLimit ? ` / ${coupon.usageLimit}` : ""}
                  </td>
                  <td className="px-4 py-3 text-xs text-brown-500">
                    {new Date(coupon.startsAt).toLocaleDateString()} &ndash;{" "}
                    {new Date(coupon.expiresAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={coupon.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      aria-label="Edit"
                      onClick={() => setEditing(coupon)}
                      className="mr-3 text-brown-500 hover:text-green-950"
                    >
                      <Pencil size={15} />
                    </button>
                    {canManage && (
                      <button
                        aria-label="Delete"
                        onClick={() => handleDelete(coupon)}
                        className="text-brown-500 hover:text-[#8a4a3f]"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 pb-4">
            <AdminPagination pagination={pagination} onPageChange={setPage} />
          </div>
        </div>
      )}

      {editing && (
        <Modal title={editing === "new" ? "Add Coupon" : "Edit Coupon"} onClose={() => setEditing(null)}>
          <CouponForm
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
