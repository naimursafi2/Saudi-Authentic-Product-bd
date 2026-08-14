"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { ApiProduct } from "@/types/api";

const fieldClasses =
  "w-full rounded border border-green-900/15 bg-cream-50 px-3 py-2 text-sm text-green-950 placeholder:text-brown-500/50 focus:border-green-900/40 focus:outline-none";
const labelClasses = "mb-1 block text-xs font-bold uppercase tracking-[0.06em] text-brown-600";

export interface InventoryAdjustFormResult {
  productId: string;
  variantId: string;
  delta: number;
  note: string;
}

export function InventoryAdjustForm({
  products,
  error,
  isSubmitting,
  onSubmit,
  onCancel,
}: {
  products: ApiProduct[];
  error: string | null;
  isSubmitting: boolean;
  onSubmit: (values: InventoryAdjustFormResult) => void;
  onCancel: () => void;
}) {
  const [productId, setProductId] = useState("");
  const [variantId, setVariantId] = useState("");
  const [delta, setDelta] = useState("");
  const [note, setNote] = useState("");

  const selectedProduct = products.find((p) => p._id === productId);

  function handleProductChange(id: string) {
    setProductId(id);
    setVariantId("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({ productId, variantId, delta: Number(delta), note });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div>
        <label className={labelClasses}>Product *</label>
        <select required value={productId} onChange={(e) => handleProductChange(e.target.value)} className={fieldClasses}>
          <option value="">Select product</option>
          {products.map((p) => (
            <option key={p._id} value={p._id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClasses}>Variant *</label>
        <select
          required
          disabled={!selectedProduct}
          value={variantId}
          onChange={(e) => setVariantId(e.target.value)}
          className={fieldClasses}
        >
          <option value="">Select variant</option>
          {selectedProduct?.variants.map((v) => (
            <option key={v._id} value={v._id}>
              {v.label} (stock: {v.stock})
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClasses}>Delta (+ to add, - to remove) *</label>
        <input required type="number" value={delta} onChange={(e) => setDelta(e.target.value)} className={fieldClasses} />
      </div>
      <div>
        <label className={labelClasses}>Note</label>
        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} className={fieldClasses} />
      </div>

      {error && <p className="text-sm text-[#8a4a3f]">{error}</p>}

      <div className="flex justify-end gap-3 border-t border-brown-600/10 pt-4">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" size="sm" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Adjust Stock"}
        </Button>
      </div>
    </form>
  );
}
