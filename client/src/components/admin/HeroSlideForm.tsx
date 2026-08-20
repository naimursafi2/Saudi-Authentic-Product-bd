"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { ApiHeroSlide } from "@/types/api";

export interface HeroSlideFormValues {
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaHref: string;
  secondaryCtaLabel: string;
  secondaryCtaHref: string;
  sortOrder: number;
  isActive: boolean;
}

const fieldClasses =
  "w-full rounded border border-green-900/15 bg-cream-50 px-3 py-2 text-sm text-green-950 placeholder:text-brown-500/50 focus:border-green-900/40 focus:outline-none";
const labelClasses = "mb-1 block text-xs font-bold uppercase tracking-[0.06em] text-brown-600";

export function fromHeroSlide(slide?: ApiHeroSlide): HeroSlideFormValues {
  if (!slide) {
    return {
      title: "",
      subtitle: "",
      ctaLabel: "Shop Now",
      ctaHref: "/shop",
      secondaryCtaLabel: "",
      secondaryCtaHref: "",
      sortOrder: 0,
      isActive: true,
    };
  }
  return {
    title: slide.title,
    subtitle: slide.subtitle ?? "",
    ctaLabel: slide.ctaLabel ?? "",
    ctaHref: slide.ctaHref ?? "",
    secondaryCtaLabel: slide.secondaryCtaLabel ?? "",
    secondaryCtaHref: slide.secondaryCtaHref ?? "",
    sortOrder: slide.sortOrder,
    isActive: slide.isActive,
  };
}

export function HeroSlideForm({
  initial,
  error,
  isSubmitting,
  onSubmit,
  onCancel,
}: {
  initial?: ApiHeroSlide;
  error: string | null;
  isSubmitting: boolean;
  onSubmit: (values: HeroSlideFormValues, image: File | null) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<HeroSlideFormValues>(() => fromHeroSlide(initial));
  const [image, setImage] = useState<File | null>(null);

  function update<K extends keyof HeroSlideFormValues>(key: K, value: HeroSlideFormValues[K]) {
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
          <label className={labelClasses}>Title *</label>
          <textarea
            required
            rows={2}
            value={values.title}
            onChange={(e) => update("title", e.target.value)}
            placeholder={"Authentic Saudi Products\nDelivered to Your Doorstep."}
            className={fieldClasses}
          />
          <p className="mt-1 text-xs text-brown-500">Use a new line to control where the headline wraps.</p>
        </div>
        <div className="sm:col-span-2">
          <label className={labelClasses}>Subtitle</label>
          <textarea
            rows={2}
            value={values.subtitle}
            onChange={(e) => update("subtitle", e.target.value)}
            className={fieldClasses}
          />
        </div>
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
        <div>
          <label className={labelClasses}>Secondary Button Label</label>
          <input
            value={values.secondaryCtaLabel}
            onChange={(e) => update("secondaryCtaLabel", e.target.value)}
            placeholder="Explore Dates"
            className={fieldClasses}
          />
          <p className="mt-1 text-xs text-brown-500">Leave blank to show a single button.</p>
        </div>
        <div>
          <label className={labelClasses}>Secondary Button Link</label>
          <input
            value={values.secondaryCtaHref}
            onChange={(e) => update("secondaryCtaHref", e.target.value)}
            placeholder="/shop?category=dates"
            className={fieldClasses}
          />
        </div>
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
              checked={values.isActive}
              onChange={(e) => update("isActive", e.target.checked)}
              className="accent-green-900"
            />
            Active
          </label>
        </div>
      </div>

      <div>
        <label className={labelClasses}>
          Banner Image {initial ? "(replaces existing image if selected)" : "*"}
        </label>
        <input
          type="file"
          accept="image/*"
          required={!initial}
          onChange={(e) => setImage(e.target.files?.[0] ?? null)}
          className="text-sm text-brown-600"
        />
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex justify-end gap-3 border-t border-brown-600/10 pt-4">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" size="sm" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Save Slide"}
        </Button>
      </div>
    </form>
  );
}
