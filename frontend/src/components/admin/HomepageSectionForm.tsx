"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { ApiCategory, ApiHomepageSection, HomepageSectionType, ProductShowcaseMode } from "@/types/api";

export interface HomepageSectionFormValues {
  title: string;
  subtitle: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
  isVisible: boolean;
  sortOrder: number;
  categorySlug: string;
  productMode: ProductShowcaseMode;
  limit: number;
}

const fieldClasses =
  "w-full rounded border border-green-900/15 bg-cream-50 px-3 py-2 text-sm text-green-950 placeholder:text-brown-500/50 focus:border-green-900/40 focus:outline-none";
const labelClasses = "mb-1 block text-xs font-bold uppercase tracking-[0.06em] text-brown-600";

const PRODUCT_MODE_LABELS: Record<ProductShowcaseMode, string> = {
  category: "Products from a category",
  bestSellers: "Best sellers",
  newArrivals: "New arrivals",
  onSale: "On sale / offers",
};

/** Which fields are relevant for a given section type — keeps the form from
 * showing e.g. a CTA field on "Best Sellers", which never renders one. */
const FIELD_VISIBILITY: Record<
  HomepageSectionType,
  { subtitle: boolean; description: boolean; image: boolean; cta: boolean; productShowcase: boolean }
> = {
  hero: { subtitle: true, description: false, image: false, cta: false, productShowcase: false },
  featuredCategories: { subtitle: false, description: false, image: false, cta: false, productShowcase: false },
  bestSellers: { subtitle: false, description: false, image: false, cta: false, productShowcase: false },
  productStory: { subtitle: false, description: true, image: true, cta: false, productShowcase: false },
  customerReviews: { subtitle: false, description: false, image: false, cta: false, productShowcase: false },
  promoBanner: { subtitle: false, description: true, image: true, cta: true, productShowcase: false },
  productShowcase: { subtitle: true, description: false, image: false, cta: true, productShowcase: true },
};

export function fromHomepageSection(section?: ApiHomepageSection): HomepageSectionFormValues {
  if (!section) {
    return {
      title: "",
      subtitle: "",
      description: "",
      ctaLabel: "",
      ctaHref: "",
      isVisible: true,
      sortOrder: 0,
      categorySlug: "",
      productMode: "category",
      limit: 8,
    };
  }
  return {
    title: section.title ?? "",
    subtitle: section.subtitle ?? "",
    description: section.description ?? "",
    ctaLabel: section.ctaLabel ?? "",
    ctaHref: section.ctaHref ?? "",
    isVisible: section.isVisible,
    sortOrder: section.sortOrder,
    categorySlug: section.categorySlug ?? "",
    productMode: section.productMode ?? "category",
    limit: section.limit ?? 8,
  };
}

export function HomepageSectionForm({
  type,
  initial,
  categories,
  error,
  isSubmitting,
  onSubmit,
  onCancel,
}: {
  type: HomepageSectionType;
  initial?: ApiHomepageSection;
  categories?: ApiCategory[];
  error: string | null;
  isSubmitting: boolean;
  onSubmit: (values: HomepageSectionFormValues, image: File | null) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<HomepageSectionFormValues>(() => fromHomepageSection(initial));
  const [image, setImage] = useState<File | null>(null);
  const fields = FIELD_VISIBILITY[type];

  function update<K extends keyof HomepageSectionFormValues>(key: K, value: HomepageSectionFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(values, image);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={labelClasses}>Title</label>
          <input value={values.title} onChange={(e) => update("title", e.target.value)} className={fieldClasses} />
        </div>
        {fields.subtitle && (
          <div className="sm:col-span-2">
            <label className={labelClasses}>Subtitle</label>
            <textarea
              rows={2}
              value={values.subtitle}
              onChange={(e) => update("subtitle", e.target.value)}
              className={fieldClasses}
            />
          </div>
        )}
        {fields.description && (
          <div className="sm:col-span-2">
            <label className={labelClasses}>Description</label>
            <textarea
              rows={4}
              value={values.description}
              onChange={(e) => update("description", e.target.value)}
              className={fieldClasses}
            />
          </div>
        )}
        {fields.productShowcase && (
          <>
            <div>
              <label className={labelClasses}>Product Source</label>
              <select
                value={values.productMode}
                onChange={(e) => update("productMode", e.target.value as ProductShowcaseMode)}
                className={fieldClasses}
              >
                {Object.entries(PRODUCT_MODE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            {values.productMode === "category" && (
              <div>
                <label className={labelClasses}>Category</label>
                <select
                  value={values.categorySlug}
                  onChange={(e) => update("categorySlug", e.target.value)}
                  className={fieldClasses}
                >
                  <option value="">Select a category&hellip;</option>
                  {categories?.map((category) => (
                    <option key={category.slug} value={category.slug}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className={labelClasses}>Max Products</label>
              <input
                type="number"
                min={1}
                max={12}
                value={values.limit}
                onChange={(e) => update("limit", Number(e.target.value))}
                className={fieldClasses}
              />
            </div>
          </>
        )}
        {fields.cta && (
          <>
            <div>
              <label className={labelClasses}>CTA Label</label>
              <input
                value={values.ctaLabel}
                onChange={(e) => update("ctaLabel", e.target.value)}
                placeholder="Shop Now"
                className={fieldClasses}
              />
            </div>
            <div>
              <label className={labelClasses}>CTA Link</label>
              <input
                value={values.ctaHref}
                onChange={(e) => update("ctaHref", e.target.value)}
                placeholder="/shop"
                className={fieldClasses}
              />
            </div>
          </>
        )}
        <div>
          <label className={labelClasses}>Sort Order</label>
          <input
            type="number"
            value={values.sortOrder}
            onChange={(e) => update("sortOrder", Number(e.target.value))}
            className={fieldClasses}
          />
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 text-sm text-brown-600">
            <input
              type="checkbox"
              checked={values.isVisible}
              onChange={(e) => update("isVisible", e.target.checked)}
              className="accent-green-900"
            />
            Visible on homepage
          </label>
        </div>
      </div>

      {fields.image && (
        <div>
          <label className={labelClasses}>Image {initial ? "(replaces existing image if selected)" : ""}</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setImage(e.target.files?.[0] ?? null)}
            className="text-sm text-brown-600"
          />
        </div>
      )}

      {error && <p className="text-sm text-[#8a4a3f]">{error}</p>}

      <div className="flex justify-end gap-3 border-t border-brown-600/10 pt-4">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" size="sm" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Save Section"}
        </Button>
      </div>
    </form>
  );
}
