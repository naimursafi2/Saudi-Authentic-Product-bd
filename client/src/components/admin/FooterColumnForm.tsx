"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { ApiFooterColumn, ApiFooterLink } from "@/types/api";

export interface FooterColumnFormValues {
  heading: string;
  sortOrder: number;
  isVisible: boolean;
  links: ApiFooterLink[];
}

const fieldClasses =
  "w-full rounded border border-green-900/15 bg-cream-50 px-3 py-2 text-sm text-green-950 placeholder:text-brown-500/50 focus:border-green-900/40 focus:outline-none";
const labelClasses = "mb-1 block text-xs font-bold uppercase tracking-[0.06em] text-brown-600";

function fromColumn(column?: ApiFooterColumn): FooterColumnFormValues {
  if (!column) {
    return { heading: "", sortOrder: 0, isVisible: true, links: [] };
  }
  return {
    heading: column.heading,
    sortOrder: column.sortOrder,
    isVisible: column.isVisible,
    links: column.links,
  };
}

export function FooterColumnForm({
  initial,
  error,
  isSubmitting,
  onSubmit,
  onCancel,
}: {
  initial?: ApiFooterColumn;
  error: string | null;
  isSubmitting: boolean;
  onSubmit: (values: FooterColumnFormValues) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<FooterColumnFormValues>(() => fromColumn(initial));

  function update<K extends keyof FooterColumnFormValues>(key: K, value: FooterColumnFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function updateLink(index: number, field: keyof ApiFooterLink, value: string | number) {
    setValues((prev) => ({
      ...prev,
      links: prev.links.map((link, i) => (i === index ? { ...link, [field]: value } : link)),
    }));
  }

  function addLink() {
    setValues((prev) => ({
      ...prev,
      links: [...prev.links, { label: "", href: "", sortOrder: prev.links.length }],
    }));
  }

  function removeLink(index: number) {
    setValues((prev) => ({ ...prev, links: prev.links.filter((_, i) => i !== index) }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClasses}>Heading *</label>
          <input
            required
            value={values.heading}
            onChange={(e) => update("heading", e.target.value)}
            placeholder="Explore"
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
              checked={values.isVisible}
              onChange={(e) => update("isVisible", e.target.checked)}
              className="accent-green-900"
            />
            Visible
          </label>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className={labelClasses}>Links</label>
          <Button type="button" variant="outline" size="sm" onClick={addLink}>
            <Plus size={12} /> Add Link
          </Button>
        </div>
        <div className="flex flex-col gap-2">
          {values.links.map((link, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                required
                value={link.label}
                onChange={(e) => updateLink(i, "label", e.target.value)}
                placeholder="Label"
                className={fieldClasses}
              />
              <input
                required
                value={link.href}
                onChange={(e) => updateLink(i, "href", e.target.value)}
                placeholder="/path"
                className={fieldClasses}
              />
              <button
                type="button"
                aria-label="Remove link"
                onClick={() => removeLink(i)}
                className="shrink-0 cursor-pointer text-brown-500 hover:text-danger"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          {values.links.length === 0 && (
            <p className="text-xs text-brown-500">No links yet — add one above.</p>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex justify-end gap-3 border-t border-brown-600/10 pt-4">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" size="sm" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Save Column"}
        </Button>
      </div>
    </form>
  );
}
