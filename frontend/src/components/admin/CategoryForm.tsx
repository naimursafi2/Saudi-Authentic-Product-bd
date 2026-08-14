"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { ApiCategory } from "@/types/api";

export interface CategoryFormValues {
  name: string;
  slug: string;
  description: string;
  sortOrder: number;
  isComingSoon: boolean;
}

const fieldClasses =
  "w-full rounded border border-green-900/15 bg-cream-50 px-3 py-2 text-sm text-green-950 placeholder:text-brown-500/50 focus:border-green-900/40 focus:outline-none";
const labelClasses = "mb-1 block text-xs font-bold uppercase tracking-[0.06em] text-brown-600";

export function fromCategory(category?: ApiCategory): CategoryFormValues {
  if (!category) {
    return { name: "", slug: "", description: "", sortOrder: 0, isComingSoon: false };
  }
  return {
    name: category.name,
    slug: category.slug,
    description: category.description ?? "",
    sortOrder: category.sortOrder,
    isComingSoon: category.isComingSoon,
  };
}

export function CategoryForm({
  initial,
  error,
  isSubmitting,
  onSubmit,
  onCancel,
}: {
  initial?: ApiCategory;
  error: string | null;
  isSubmitting: boolean;
  onSubmit: (values: CategoryFormValues, image: File | null) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<CategoryFormValues>(() => fromCategory(initial));
  const [image, setImage] = useState<File | null>(null);

  function update<K extends keyof CategoryFormValues>(key: K, value: CategoryFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(values, image);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClasses}>Name *</label>
          <input
            required
            minLength={2}
            maxLength={80}
            value={values.name}
            onChange={(e) => update("name", e.target.value)}
            className={fieldClasses}
          />
        </div>
        <div>
          <label className={labelClasses}>Slug</label>
          <input
            value={values.slug}
            onChange={(e) => update("slug", e.target.value)}
            placeholder="auto-generated from name"
            className={fieldClasses}
          />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClasses}>Description</label>
          <textarea
            rows={3}
            maxLength={500}
            value={values.description}
            onChange={(e) => update("description", e.target.value)}
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
              checked={values.isComingSoon}
              onChange={(e) => update("isComingSoon", e.target.checked)}
              className="accent-green-900"
            />
            Coming Soon
          </label>
        </div>
      </div>

      <div>
        <label className={labelClasses}>Category Image</label>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setImage(e.target.files?.[0] ?? null)}
          className="text-sm text-brown-600"
        />
      </div>

      {error && <p className="text-sm text-[#8a4a3f]">{error}</p>}

      <div className="flex justify-end gap-3 border-t border-brown-600/10 pt-4">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" size="sm" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Save Category"}
        </Button>
      </div>
    </form>
  );
}
