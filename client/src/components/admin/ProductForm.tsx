"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { ApiProduct, ProductBadge } from "@/types/api";
import type { Category } from "@/types/product";

export interface ProductFormVariant {
  label: string;
  priceBDT: number;
  compareAtPriceBDT?: number;
  stock: number;
  lowStockThreshold: number;
  sku?: string;
}

export interface ProductFormValues {
  name: string;
  tagline: string;
  description: string;
  origin: string;
  categories: string[];
  badge?: ProductBadge;
  variants: ProductFormVariant[];
  highlights: string[];
  storageInstructions?: string;
  isBestSeller: boolean;
  isFeatured: boolean;
}

const BADGES: ProductBadge[] = ["Authentic", "Best Seller", "New", "Limited"];
const fieldClasses =
  "w-full rounded border border-green-900/15 bg-cream-50 px-3 py-2 text-sm text-green-950 placeholder:text-brown-500/50 focus:border-green-900/40 focus:outline-none";
const labelClasses = "mb-1 block text-xs font-bold uppercase tracking-[0.06em] text-brown-600";

function fromProduct(product?: ApiProduct): ProductFormValues {
  if (!product) {
    return {
      name: "",
      tagline: "",
      description: "",
      origin: "",
      categories: [],
      variants: [{ label: "", priceBDT: 0, stock: 0, lowStockThreshold: 10 }],
      highlights: [],
      isBestSeller: false,
      isFeatured: false,
    };
  }
  return {
    name: product.name,
    tagline: product.tagline,
    description: product.description,
    origin: product.origin,
    categories: product.categories.map((c) => (typeof c === "string" ? c : c._id)),
    badge: product.badge,
    variants: product.variants.map((v) => ({
      label: v.label,
      priceBDT: v.priceBDT,
      compareAtPriceBDT: v.compareAtPriceBDT,
      stock: v.stock,
      lowStockThreshold: v.lowStockThreshold,
      sku: v.sku,
    })),
    highlights: product.highlights,
    storageInstructions: product.storageInstructions,
    isBestSeller: product.isBestSeller,
    isFeatured: product.isFeatured,
  };
}

export function ProductForm({
  initial,
  categories,
  error,
  isSubmitting,
  onSubmit,
  onCancel,
}: {
  initial?: ApiProduct;
  categories: Category[];
  error: string | null;
  isSubmitting: boolean;
  onSubmit: (values: ProductFormValues, images: File[]) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<ProductFormValues>(() => fromProduct(initial));
  const [highlightsText, setHighlightsText] = useState(initial?.highlights.join("\n") ?? "");
  const [images, setImages] = useState<File[]>([]);

  function update<K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function updateVariant(index: number, patch: Partial<ProductFormVariant>) {
    setValues((prev) => ({
      ...prev,
      variants: prev.variants.map((v, i) => (i === index ? { ...v, ...patch } : v)),
    }));
  }

  function addVariant() {
    setValues((prev) => ({
      ...prev,
      variants: [...prev.variants, { label: "", priceBDT: 0, stock: 0, lowStockThreshold: 10 }],
    }));
  }

  function removeVariant(index: number) {
    setValues((prev) => ({ ...prev, variants: prev.variants.filter((_, i) => i !== index) }));
  }

  function toggleCategory(id: string) {
    setValues((prev) => ({
      ...prev,
      categories: prev.categories.includes(id)
        ? prev.categories.filter((c) => c !== id)
        : [...prev.categories, id],
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(
      { ...values, highlights: highlightsText.split("\n").map((s) => s.trim()).filter(Boolean) },
      images
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClasses}>Name *</label>
          <input required value={values.name} onChange={(e) => update("name", e.target.value)} className={fieldClasses} />
        </div>
        <div>
          <label className={labelClasses}>Origin *</label>
          <input required value={values.origin} onChange={(e) => update("origin", e.target.value)} className={fieldClasses} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClasses}>Tagline *</label>
          <input required value={values.tagline} onChange={(e) => update("tagline", e.target.value)} className={fieldClasses} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClasses}>Description *</label>
          <textarea
            required
            rows={3}
            value={values.description}
            onChange={(e) => update("description", e.target.value)}
            className={fieldClasses}
          />
        </div>
        <div>
          <label className={labelClasses}>Badge</label>
          <select
            value={values.badge ?? ""}
            onChange={(e) => update("badge", (e.target.value || undefined) as ProductBadge | undefined)}
            className={fieldClasses}
          >
            <option value="">None</option>
            {BADGES.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClasses}>Storage Instructions</label>
          <input
            value={values.storageInstructions ?? ""}
            onChange={(e) => update("storageInstructions", e.target.value)}
            className={fieldClasses}
          />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClasses}>Highlights (one per line)</label>
          <textarea
            rows={3}
            value={highlightsText}
            onChange={(e) => setHighlightsText(e.target.value)}
            placeholder="Rich in Antioxidants: Helps combat oxidative stress"
            className={fieldClasses}
          />
        </div>
      </div>

      <div>
        <label className={labelClasses}>Categories *</label>
        <div className="flex flex-wrap gap-3">
          {categories.map((c) => (
            <label key={c.id} className="flex items-center gap-1.5 text-sm text-brown-600">
              <input
                type="checkbox"
                checked={values.categories.includes(c.id)}
                onChange={() => toggleCategory(c.id)}
                className="accent-green-900"
              />
              {c.name}
            </label>
          ))}
        </div>
      </div>

      <div className="flex gap-6">
        <label className="flex items-center gap-2 text-sm text-brown-600">
          <input
            type="checkbox"
            checked={values.isBestSeller}
            onChange={(e) => update("isBestSeller", e.target.checked)}
            className="accent-green-900"
          />
          Best Seller
        </label>
        <label className="flex items-center gap-2 text-sm text-brown-600">
          <input
            type="checkbox"
            checked={values.isFeatured}
            onChange={(e) => update("isFeatured", e.target.checked)}
            className="accent-green-900"
          />
          Featured
        </label>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className={`${labelClasses} mb-0`}>Variants *</label>
          <button type="button" onClick={addVariant} className="text-xs font-bold text-green-900 hover:underline">
            <Plus size={12} className="inline" /> Add Variant
          </button>
        </div>
        <div className="flex flex-col gap-3">
          {values.variants.map((v, i) => (
            <div key={i} className="grid grid-cols-2 gap-2 rounded border border-green-900/10 p-3 sm:grid-cols-6">
              <input
                required
                placeholder="Label (500g)"
                value={v.label}
                onChange={(e) => updateVariant(i, { label: e.target.value })}
                className={`${fieldClasses} sm:col-span-2`}
              />
              <input
                required
                type="number"
                min={0}
                placeholder="Price"
                value={v.priceBDT || ""}
                onChange={(e) => updateVariant(i, { priceBDT: Number(e.target.value) })}
                className={fieldClasses}
              />
              <input
                type="number"
                min={0}
                placeholder="Compare At"
                value={v.compareAtPriceBDT ?? ""}
                onChange={(e) =>
                  updateVariant(i, { compareAtPriceBDT: e.target.value ? Number(e.target.value) : undefined })
                }
                className={fieldClasses}
              />
              <input
                required
                type="number"
                min={0}
                placeholder="Stock"
                value={v.stock || ""}
                onChange={(e) => updateVariant(i, { stock: Number(e.target.value) })}
                className={fieldClasses}
              />
              <div className="flex gap-2">
                <input
                  type="number"
                  min={0}
                  placeholder="Low stock at"
                  value={v.lowStockThreshold || ""}
                  onChange={(e) => updateVariant(i, { lowStockThreshold: Number(e.target.value) })}
                  className={fieldClasses}
                />
                {values.variants.length > 1 && (
                  <button
                    type="button"
                    aria-label="Remove variant"
                    onClick={() => removeVariant(i)}
                    className="shrink-0 text-brown-500 hover:text-[#8a4a3f]"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <label className={labelClasses}>Product Photos (replaces existing gallery if selected)</label>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => setImages(Array.from(e.target.files ?? []))}
          className="text-sm text-brown-600"
        />
      </div>

      {error && <p className="text-sm text-[#8a4a3f]">{error}</p>}

      <div className="flex justify-end gap-3 border-t border-brown-600/10 pt-4">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" size="sm" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Save Product"}
        </Button>
      </div>
    </form>
  );
}
