"use client";

import { useState } from "react";
import Image from "next/image";
import { ArrowLeft, ArrowRight, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Tooltip } from "@/components/ui/Tooltip";
import type { ApiProduct, ApiProductImage, ProductBadge } from "@/types/api";
import type { Category } from "@/types/product";

export interface ProductFormVariant {
  /**
   * Existing variant's id, round-tripped so saving the product keeps the same
   * `_id`. Without it the backend mints a new id on every save, orphaning the
   * `variantId` already stored on cart lines and order items. Undefined for a
   * variant the user just added.
   */
  id?: string;
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
  /** The current gallery, in display order — see the "Photos" section below. */
  existingImages: ApiProductImage[];
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
      existingImages: [],
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
      id: v._id,
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
    existingImages: product.images,
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

  function removeExistingImage(publicId: string) {
    setValues((prev) => ({
      ...prev,
      existingImages: prev.existingImages.filter((img) => img.publicId !== publicId),
    }));
  }

  function moveExistingImage(index: number, direction: "left" | "right") {
    setValues((prev) => {
      const swapWith = direction === "left" ? index - 1 : index + 1;
      if (swapWith < 0 || swapWith >= prev.existingImages.length) return prev;
      const next = [...prev.existingImages];
      [next[index], next[swapWith]] = [next[swapWith], next[index]];
      return { ...prev, existingImages: next };
    });
  }

  function addNewImages(files: FileList | null) {
    if (!files) return;
    const totalAfter = values.existingImages.length + images.length + files.length;
    if (totalAfter > 6) {
      alert("A product can have at most 6 images.");
      return;
    }
    setImages((prev) => [...prev, ...Array.from(files)]);
  }

  function removeNewImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index));
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
          <button type="button" onClick={addVariant} className="cursor-pointer text-xs font-bold text-green-900 hover:underline">
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
                  <Tooltip label="Remove variant">
                    <button
                      type="button"
                      aria-label="Remove variant"
                      onClick={() => removeVariant(i)}
                      className="inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full bg-delete p-1.5 text-white transition-colors duration-200 ease-in-out hover:bg-delete-hover"
                    >
                      <Trash2 size={16} />
                    </button>
                  </Tooltip>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <label className={labelClasses}>Product Photos (up to 6 — first is the primary image)</label>
        {(values.existingImages.length > 0 || images.length > 0) && (
          <div className="mb-3 flex flex-wrap gap-3">
            {values.existingImages.map((img, i) => (
              <div
                key={img.publicId}
                className="group relative size-20 shrink-0 overflow-hidden rounded border border-brown-600/15"
              >
                <Image src={img.url} alt="" fill sizes="80px" className="object-cover" />
                <div className="absolute inset-0 flex flex-col items-center justify-between bg-black/0 opacity-0 transition-opacity group-hover:bg-black/40 group-hover:opacity-100">
                  <button
                    type="button"
                    aria-label="Remove image"
                    onClick={() => removeExistingImage(img.publicId)}
                    className="mt-1 cursor-pointer self-end rounded-full bg-white/90 p-0.5 mr-1 text-danger hover:bg-white"
                  >
                    <X size={12} />
                  </button>
                  <div className="mb-1 flex gap-1">
                    <button
                      type="button"
                      aria-label="Move earlier"
                      disabled={i === 0}
                      onClick={() => moveExistingImage(i, "left")}
                      className="cursor-pointer rounded-full bg-white/90 p-0.5 text-green-950 hover:bg-white disabled:opacity-30"
                    >
                      <ArrowLeft size={12} />
                    </button>
                    <button
                      type="button"
                      aria-label="Move later"
                      disabled={i === values.existingImages.length - 1}
                      onClick={() => moveExistingImage(i, "right")}
                      className="cursor-pointer rounded-full bg-white/90 p-0.5 text-green-950 hover:bg-white disabled:opacity-30"
                    >
                      <ArrowRight size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {images.map((file, i) => (
              <div
                key={`${file.name}-${i}`}
                className="group relative size-20 shrink-0 overflow-hidden rounded border-2 border-dashed border-gold-500/50"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={URL.createObjectURL(file)}
                  alt=""
                  className="size-full object-cover"
                />
                <span className="absolute bottom-0 left-0 right-0 bg-black/50 py-0.5 text-center text-[9px] font-bold uppercase tracking-wide text-white">
                  New
                </span>
                <button
                  type="button"
                  aria-label="Remove new image"
                  onClick={() => removeNewImage(i)}
                  className="absolute right-1 top-1 cursor-pointer rounded-full bg-white/90 p-0.5 text-danger opacity-0 transition-opacity hover:bg-white group-hover:opacity-100"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => {
            addNewImages(e.target.files);
            e.target.value = "";
          }}
          className="text-sm text-brown-600"
        />
        <p className="mt-1 text-xs text-brown-500">
          Hover a photo to remove or reorder it. New photos are added to the gallery — they don&apos;t
          replace what&apos;s already there.
        </p>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

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
