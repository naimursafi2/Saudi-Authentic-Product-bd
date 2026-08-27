"use client";

import { useEffect, useState } from "react";
import { Plus, Truck, PackageCheck, Trash2, Ban } from "lucide-react";
import {
  cancelPurchase,
  createPurchase,
  deletePurchase,
  getPurchase,
  listPurchases,
  receivePurchase,
  type CostItemPayload,
} from "@/lib/api/purchases";
import { listShops } from "@/lib/api/shops";
import { listProducts } from "@/lib/api/products";
import { ApiClientError } from "@/lib/api/client";
import { useAuth } from "@/context/AuthContext";
import { useConfirm } from "@/context/ConfirmDialogContext";
import { formatBDT, formatBDTPrecise } from "@/lib/utils";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState, TableSkeleton, ErrorState } from "@/components/admin/EmptyState";
import { Modal } from "@/components/admin/Modal";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { PurchaseCostEditor, CostItemForm } from "@/components/admin/PurchaseCostEditor";
import { PurchaseSummary } from "@/components/admin/PurchaseSummary";
import { Button } from "@/components/ui/Button";
import { ActionButton } from "@/components/ui/ActionButton";
import type { ApiProduct, ApiPurchase, ApiShop, Pagination, PurchaseStatus } from "@/types/api";

const fieldClasses =
  "w-full rounded border border-green-900/15 bg-cream-50 px-3 py-2 text-sm text-green-950 placeholder:text-brown-500/50 focus:border-green-900/40 focus:outline-none";
const labelClasses = "mb-1 block text-xs font-bold uppercase tracking-[0.06em] text-brown-600";

const STATUS_FILTERS: { value: PurchaseStatus | ""; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "awaiting_stock_approval", label: "Awaiting approval" },
  { value: "received", label: "Received" },
  { value: "cancelled", label: "Cancelled" },
];

function shopName(shop: ApiPurchase["shop"]): string {
  return typeof shop === "string" ? shop : shop.name;
}

export default function AdminPurchasesPage() {
  const { hasPermission } = useAuth();
  const confirmDialog = useConfirm();
  const canCreate = hasPermission("purchases.create");
  const canEdit = hasPermission("purchases.edit");
  const canDelete = hasPermission("purchases.delete");

  const [purchases, setPurchases] = useState<ApiPurchase[]>([]);
  const [shops, setShops] = useState<ApiShop[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [shopFilter, setShopFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<PurchaseStatus | "">("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [isCreating, setIsCreating] = useState(false);
  const [detail, setDetail] = useState<ApiPurchase | null>(null);

  function load() {
    setIsLoading(true);
    listPurchases({
      page,
      limit: 20,
      shop: shopFilter || undefined,
      status: statusFilter || undefined,
    })
      .then(({ data, pagination: pg }) => {
        setPurchases(data.purchases);
        setPagination(pg ?? null);
        setError(null);
      })
      .catch(() => setError("Could not load purchases."))
      .finally(() => setIsLoading(false));
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(load, [page, shopFilter, statusFilter]);

  useEffect(() => {
    listShops()
      .then(({ data }) => setShops(data.shops))
      .catch(() => setShops([]));
  }, []);

  async function openDetail(purchase: ApiPurchase) {
    setDetail(purchase);
    // Re-read so the modal always opens on the live cost list, even if the
    // row behind it was rendered from an older page load.
    try {
      const { data } = await getPurchase(purchase._id);
      setDetail(data.purchase);
    } catch {
      // The row's own copy is good enough to show; a failure here is not fatal.
    }
  }

  async function handleReceive(purchase: ApiPurchase) {
    setActionError(null);
    setNotice(null);
    try {
      const { data, message } = await receivePurchase(purchase._id);
      setNotice(
        data.pendingActionId
          ? "Stock increase submitted for Super Admin approval. The live stock count is unchanged until it is granted."
          : message
      );
      setDetail(data.purchase);
      load();
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.message : "Could not receive this purchase.");
    }
  }

  async function handleCancel(purchase: ApiPurchase) {
    const ok = await confirmDialog({
      title: "Cancel Purchase",
      message: `Cancel purchase ${purchase.reference}?`,
      confirmLabel: "Cancel Purchase",
      tone: "danger",
    });
    if (!ok) return;
    setActionError(null);
    try {
      const { data } = await cancelPurchase(purchase._id);
      setDetail(data.purchase);
      load();
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.message : "Could not cancel this purchase.");
    }
  }

  async function handleDelete(purchase: ApiPurchase) {
    const ok = await confirmDialog({
      title: "Delete Purchase",
      message: `Delete purchase ${purchase.reference} and its cost breakdown?`,
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    setActionError(null);
    try {
      await deletePurchase(purchase._id);
      setDetail(null);
      load();
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.message : "Could not delete this purchase.");
    }
  }

  return (
    <div>
      <PageHeader
        title="Purchases"
        description="Every purchase batch with its own cost breakdown. Add any cost you need — there is no fixed list."
        action={
          canCreate ? (
            <Button variant="primary" size="sm" onClick={() => setIsCreating(true)}>
              <Plus size={14} /> Record Purchase
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <select
          value={shopFilter}
          onChange={(e) => {
            setShopFilter(e.target.value);
            setPage(1);
          }}
          className={`${fieldClasses} max-w-[220px]`}
        >
          <option value="">All shops</option>
          {shops.map((shop) => (
            <option key={shop._id} value={shop._id}>
              {shop.name}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as PurchaseStatus | "");
            setPage(1);
          }}
          className={`${fieldClasses} max-w-[220px]`}
        >
          {STATUS_FILTERS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {notice && <p className="mb-4 rounded bg-gold-soft px-4 py-3 text-sm text-gold-700">{notice}</p>}
      {actionError && <p className="mb-4 text-sm text-danger">{actionError}</p>}

      {isLoading ? (
        <TableSkeleton />
      ) : error ? (
        <ErrorState message={error} />
      ) : purchases.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="No purchases yet"
          description="Record a purchase batch to start tracking its landed cost."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-brown-600/10 bg-surface">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-brown-600/10 text-xs uppercase tracking-wide text-brown-500">
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Item</th>
                <th className="px-4 py-3">Shop</th>
                <th className="px-4 py-3">Qty</th>
                <th className="px-4 py-3">Landed cost</th>
                <th className="px-4 py-3">Unit cost</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {purchases.map((purchase) => (
                <tr
                  key={purchase._id}
                  onClick={() => openDetail(purchase)}
                  className="cursor-pointer border-b border-brown-600/10 last:border-none hover:bg-cream-100"
                >
                  <td className="px-4 py-3 font-mono text-xs text-brown-600">{purchase.reference}</td>
                  <td className="px-4 py-3 font-medium text-green-950">
                    {purchase.itemName}
                    <span className="block text-xs font-normal text-brown-500">
                      {purchase.costItems.length} cost
                      {purchase.costItems.length === 1 ? "" : "s"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-brown-600">{shopName(purchase.shop)}</td>
                  <td className="px-4 py-3 text-brown-600">
                    {purchase.quantity} {purchase.unit}
                  </td>
                  <td className="px-4 py-3 text-brown-600">{formatBDT(purchase.totalLandedCostBDT)}</td>
                  <td className="px-4 py-3 font-semibold text-green-950">
                    {formatBDTPrecise(purchase.unitCostBDT)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={purchase.status} />
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

      {isCreating && (
        <PurchaseForm
          shops={shops}
          onClose={() => setIsCreating(false)}
          onSaved={(purchase) => {
            setIsCreating(false);
            load();
            setDetail(purchase);
          }}
        />
      )}

      {detail && (
        <Modal title={`Purchase ${detail.reference}`} onClose={() => setDetail(null)} wide>
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Field label="Item" value={detail.itemName} />
              <Field label="Shop" value={shopName(detail.shop)} />
              <Field label="Supplier" value={detail.supplierName ?? "-"} />
              <Field label="Purchased" value={new Date(detail.purchasedAt).toLocaleDateString()} />
              <Field label="Variant" value={detail.variantLabel ?? "Not linked to stock"} />
              <div>
                <p className={labelClasses}>Status</p>
                <StatusBadge status={detail.status} />
              </div>
            </div>

            {detail.note && <p className="text-sm text-brown-600">{detail.note}</p>}

            <PurchaseSummary purchase={detail} />

            <PurchaseCostEditor
              purchase={detail}
              editable={canEdit && detail.status === "draft"}
              onChange={(updated) => {
                setDetail(updated);
                load();
              }}
            />

            {detail.status === "awaiting_stock_approval" && (
              <p className="rounded bg-gold-soft px-4 py-3 text-sm text-gold-700">
                The stock increase for this batch is waiting on a Super Admin grant. Live stock is
                unchanged until then; the cost breakdown above is already saved.
              </p>
            )}

            <div className="flex flex-wrap justify-end gap-2 border-t border-brown-600/10 pt-4">
              {canEdit && detail.status === "draft" && (
                <Button variant="outline" size="sm" onClick={() => handleCancel(detail)}>
                  <Ban size={14} /> Cancel Batch
                </Button>
              )}
              {canDelete && detail.status !== "received" && (
                <Button variant="danger" size="sm" onClick={() => handleDelete(detail)}>
                  <Trash2 size={14} /> Delete
                </Button>
              )}
              {canEdit && detail.status === "draft" && (
                <Button variant="primary" size="sm" onClick={() => handleReceive(detail)}>
                  <PackageCheck size={14} /> Mark Received
                </Button>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className={labelClasses}>{label}</p>
      <p className="text-green-950">{value}</p>
    </div>
  );
}

function PurchaseForm({
  shops,
  onClose,
  onSaved,
}: {
  shops: ApiShop[];
  onClose: () => void;
  onSaved: (purchase: ApiPurchase) => void;
}) {
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [shop, setShop] = useState("");
  const [productId, setProductId] = useState("");
  const [variantId, setVariantId] = useState("");
  const [itemName, setItemName] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [purchasedAt, setPurchasedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState("pcs");
  const [productCostBDT, setProductCostBDT] = useState("");
  const [note, setNote] = useState("");
  const [costItems, setCostItems] = useState<CostItemPayload[]>([]);
  const [isAddingCost, setIsAddingCost] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    listProducts({ limit: 100 })
      .then(({ data }) => setProducts(data.products))
      .catch(() => setProducts([]));
  }, []);

  const selectedProduct = products.find((product) => product._id === productId);
  const additionalCost = costItems.reduce((sum, item) => sum + (Number(item.amountBDT) || 0), 0);
  const landedCost = (Number(productCostBDT) || 0) + additionalCost;
  const qty = Number(quantity) || 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);
    try {
      const { data } = await createPurchase({
        shop,
        product: productId || undefined,
        variantId: productId ? variantId : undefined,
        itemName: itemName.trim() || undefined,
        supplierName: supplierName.trim() || undefined,
        purchasedAt: new Date(purchasedAt).toISOString(),
        quantity: Number(quantity),
        unit,
        productCostBDT: Number(productCostBDT),
        note: note.trim() || undefined,
        costItems,
      });
      onSaved(data.purchase);
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.message : "Could not record this purchase.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal title="Record Purchase" onClose={onClose} wide>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClasses}>Shop *</label>
            <select required value={shop} onChange={(e) => setShop(e.target.value)} className={fieldClasses}>
              <option value="">Select a shop</option>
              {shops.map((option) => (
                <option key={option._id} value={option._id}>
                  {option.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClasses}>Supplier</label>
            <input
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              className={fieldClasses}
            />
          </div>
          <div>
            <label className={labelClasses}>Catalogue product</label>
            <select
              value={productId}
              onChange={(e) => {
                setProductId(e.target.value);
                setVariantId("");
              }}
              className={fieldClasses}
            >
              <option value="">Not linked (free-text item)</option>
              {products.map((product) => (
                <option key={product._id} value={product._id}>
                  {product.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClasses}>Variant {productId && "*"}</label>
            <select
              required={Boolean(productId)}
              disabled={!selectedProduct}
              value={variantId}
              onChange={(e) => setVariantId(e.target.value)}
              className={fieldClasses}
            >
              <option value="">{selectedProduct ? "Select a variant" : "Select a product first"}</option>
              {selectedProduct?.variants.map((variant) => (
                <option key={variant._id} value={variant._id}>
                  {variant.label} (stock {variant.stock})
                </option>
              ))}
            </select>
          </div>
        </div>

        {!productId && (
          <div>
            <label className={labelClasses}>Item name *</label>
            <input
              required
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="What was purchased"
              className={fieldClasses}
            />
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div>
            <label className={labelClasses}>Quantity *</label>
            <input
              required
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className={fieldClasses}
            />
          </div>
          <div>
            <label className={labelClasses}>Unit</label>
            <input value={unit} onChange={(e) => setUnit(e.target.value)} className={fieldClasses} />
          </div>
          <div>
            <label className={labelClasses}>Product cost (BDT) *</label>
            <input
              required
              type="number"
              min={0}
              step="0.01"
              value={productCostBDT}
              onChange={(e) => setProductCostBDT(e.target.value)}
              className={fieldClasses}
            />
          </div>
          <div>
            <label className={labelClasses}>Purchase date *</label>
            <input
              required
              type="date"
              value={purchasedAt}
              onChange={(e) => setPurchasedAt(e.target.value)}
              className={fieldClasses}
            />
          </div>
        </div>

        <div>
          <label className={labelClasses}>Note</label>
          <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} className={fieldClasses} />
        </div>

        <div className="rounded border border-brown-600/10">
          <div className="flex items-center justify-between border-b border-brown-600/10 px-4 py-3">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-[0.08em] text-brown-600">
                Additional costs ({costItems.length})
              </h3>
              <p className="mt-0.5 text-xs text-brown-500">
                Name each cost yourself. More can be added after saving.
              </p>
            </div>
            {!isAddingCost && (
              <Button variant="outline" size="sm" onClick={() => setIsAddingCost(true)}>
                <Plus size={14} /> Add Cost
              </Button>
            )}
          </div>

          {costItems.length > 0 && (
            <ul className="divide-y divide-brown-600/10">
              {costItems.map((item, index) => (
                <li key={`${item.name}-${index}`} className="flex items-center justify-between px-4 py-2">
                  <div>
                    <p className="text-sm font-medium text-green-950">{item.name}</p>
                    {item.note && <p className="text-xs text-brown-600">{item.note}</p>}
                    {item.proof && <p className="text-xs text-gold-700">{item.proof.name}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-green-950">{formatBDT(item.amountBDT)}</span>
                    <ActionButton
                      tone="danger"
                      onClick={() => setCostItems((current) => current.filter((_, i) => i !== index))}
                    >
                      <Trash2 size={13} />
                      Remove
                    </ActionButton>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {isAddingCost && (
            <div className="border-t border-brown-600/10 px-4 py-3">
              <CostItemForm
                submitLabel="Add Cost"
                onCancel={() => setIsAddingCost(false)}
                onSubmit={async (payload) => {
                  setCostItems((current) => [...current, payload]);
                  setIsAddingCost(false);
                }}
              />
            </div>
          )}
        </div>

        <div className="rounded bg-cream-100 px-4 py-3 text-sm">
          <div className="flex justify-between">
            <span className="text-brown-600">Total landed cost</span>
            <span className="font-semibold text-green-950">{formatBDT(landedCost)}</span>
          </div>
          <div className="mt-1 flex justify-between">
            <span className="text-brown-600">Actual unit cost</span>
            <span className="font-semibold text-green-950">
              {qty > 0 ? formatBDTPrecise(landedCost / qty) : "-"}
            </span>
          </div>
        </div>

        {formError && <p className="text-sm text-danger">{formError}</p>}

        <div className="flex justify-end gap-3 border-t border-brown-600/10 pt-4">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Record Purchase"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
