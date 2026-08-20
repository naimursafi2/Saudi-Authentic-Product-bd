"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { ApiNavLink } from "@/types/api";

export interface NavLinkFormValues {
  label: string;
  href: string;
  sortOrder: number;
  isVisible: boolean;
  openInNewTab: boolean;
}

const fieldClasses =
  "w-full rounded border border-green-900/15 bg-cream-50 px-3 py-2 text-sm text-green-950 placeholder:text-brown-500/50 focus:border-green-900/40 focus:outline-none";
const labelClasses = "mb-1 block text-xs font-bold uppercase tracking-[0.06em] text-brown-600";

function fromNavLink(link?: ApiNavLink): NavLinkFormValues {
  if (!link) {
    return { label: "", href: "", sortOrder: 0, isVisible: true, openInNewTab: false };
  }
  return {
    label: link.label,
    href: link.href,
    sortOrder: link.sortOrder,
    isVisible: link.isVisible,
    openInNewTab: link.openInNewTab,
  };
}

export function NavLinkForm({
  initial,
  error,
  isSubmitting,
  onSubmit,
  onCancel,
}: {
  initial?: ApiNavLink;
  error: string | null;
  isSubmitting: boolean;
  onSubmit: (values: NavLinkFormValues) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<NavLinkFormValues>(() => fromNavLink(initial));

  function update<K extends keyof NavLinkFormValues>(key: K, value: NavLinkFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClasses}>Label *</label>
          <input
            required
            value={values.label}
            onChange={(e) => update("label", e.target.value)}
            placeholder="Shop"
            className={fieldClasses}
          />
        </div>
        <div>
          <label className={labelClasses}>Link *</label>
          <input
            required
            value={values.href}
            onChange={(e) => update("href", e.target.value)}
            placeholder="/shop"
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
        <div className="flex items-end gap-5">
          <label className="flex items-center gap-2 text-sm text-brown-600">
            <input
              type="checkbox"
              checked={values.isVisible}
              onChange={(e) => update("isVisible", e.target.checked)}
              className="accent-green-900"
            />
            Visible
          </label>
          <label className="flex items-center gap-2 text-sm text-brown-600">
            <input
              type="checkbox"
              checked={values.openInNewTab}
              onChange={(e) => update("openInNewTab", e.target.checked)}
              className="accent-green-900"
            />
            Open in new tab
          </label>
        </div>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex justify-end gap-3 border-t border-brown-600/10 pt-4">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" size="sm" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Save Link"}
        </Button>
      </div>
    </form>
  );
}
