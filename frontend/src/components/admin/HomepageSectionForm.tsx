"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { ApiHomepageSection, HomepageSectionType } from "@/types/api";

export interface HomepageSectionFormValues {
  title: string;
  subtitle: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
  isVisible: boolean;
  sortOrder: number;
}

const fieldClasses =
  "w-full rounded border border-green-900/15 bg-cream-50 px-3 py-2 text-sm text-green-950 placeholder:text-brown-500/50 focus:border-green-900/40 focus:outline-none";
const labelClasses = "mb-1 block text-xs font-bold uppercase tracking-[0.06em] text-brown-600";

/** Which fields are relevant for a given fixed-section type — keeps the form
 * from showing e.g. a CTA field on "Best Sellers", which never renders one. */
const FIELD_VISIBILITY: Record<HomepageSectionType, { subtitle: boolean; description: boolean; image: boolean; cta: boolean }> = {
  hero: { subtitle: true, description: false, image: false, cta: false },
  featuredCategories: { subtitle: false, description: false, image: false, cta: false },
  bestSellers: { subtitle: false, description: false, image: false, cta: false },
  productStory: { subtitle: false, description: true, image: true, cta: false },
  customerReviews: { subtitle: false, description: false, image: false, cta: false },
  promoBanner: { subtitle: false, description: true, image: true, cta: true },
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
  };
}

export function HomepageSectionForm({
  type,
  initial,
  error,
  isSubmitting,
  onSubmit,
  onCancel,
}: {
  type: HomepageSectionType;
  initial?: ApiHomepageSection;
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
