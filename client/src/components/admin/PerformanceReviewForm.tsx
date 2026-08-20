"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import type { ApiUser } from "@/types/api";

const fieldClasses =
  "w-full rounded border border-green-900/15 bg-cream-50 px-3 py-2 text-sm text-green-950 placeholder:text-brown-500/50 focus:border-green-900/40 focus:outline-none";
const labelClasses = "mb-1 block text-xs font-bold uppercase tracking-[0.06em] text-brown-600";

export interface PerformanceReviewFormValues {
  employee: string;
  period: string;
  rating: number;
  notes: string;
}

export function PerformanceReviewForm({
  employees,
  error,
  isSubmitting,
  onSubmit,
  onCancel,
}: {
  employees: ApiUser[];
  error: string | null;
  isSubmitting: boolean;
  onSubmit: (values: PerformanceReviewFormValues) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<PerformanceReviewFormValues>({
    employee: "",
    period: "",
    rating: 5,
    notes: "",
  });

  function update<K extends keyof PerformanceReviewFormValues>(key: K, value: PerformanceReviewFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div>
        <label className={labelClasses}>Employee *</label>
        <select
          required
          value={values.employee}
          onChange={(e) => update("employee", e.target.value)}
          className={fieldClasses}
        >
          <option value="">Select employee</option>
          {employees.map((emp) => (
            <option key={emp._id} value={emp._id}>
              {emp.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClasses}>Period *</label>
        <input
          required
          placeholder="e.g. July 2026"
          value={values.period}
          onChange={(e) => update("period", e.target.value)}
          className={fieldClasses}
        />
      </div>
      <div>
        <label className={labelClasses}>Rating *</label>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              aria-label={`${n} star${n > 1 ? "s" : ""}`}
              onClick={() => update("rating", n)}
              className="cursor-pointer p-0.5"
            >
              <Star size={22} className={cn(n <= values.rating ? "fill-gold-500 text-gold-500" : "text-brown-500/30")} />
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className={labelClasses}>Notes</label>
        <textarea rows={3} value={values.notes} onChange={(e) => update("notes", e.target.value)} className={fieldClasses} />
      </div>

      {error && <p className="text-sm text-[#8a4a3f]">{error}</p>}

      <div className="flex justify-end gap-3 border-t border-brown-600/10 pt-4">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" size="sm" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Submit Review"}
        </Button>
      </div>
    </form>
  );
}
