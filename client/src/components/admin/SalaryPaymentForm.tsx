"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { ApiUser } from "@/types/api";

const fieldClasses =
  "w-full rounded border border-green-900/15 bg-cream-50 px-3 py-2 text-sm text-green-950 placeholder:text-brown-500/50 focus:border-green-900/40 focus:outline-none";
const labelClasses = "mb-1 block text-xs font-bold uppercase tracking-[0.06em] text-brown-600";

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export interface SalaryPaymentFormValues {
  employee: string;
  month: number;
  year: number;
  amountBDT: string;
  note: string;
}

export function SalaryPaymentForm({
  employees,
  error,
  isSubmitting,
  onSubmit,
  onCancel,
}: {
  employees: ApiUser[];
  error: string | null;
  isSubmitting: boolean;
  onSubmit: (values: SalaryPaymentFormValues) => void;
  onCancel: () => void;
}) {
  const now = new Date();
  const [values, setValues] = useState<SalaryPaymentFormValues>({
    employee: "",
    month: now.getMonth() + 1,
    year: now.getFullYear(),
    amountBDT: "",
    note: "",
  });

  function update<K extends keyof SalaryPaymentFormValues>(key: K, value: SalaryPaymentFormValues[K]) {
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClasses}>Month *</label>
          <select
            required
            value={values.month}
            onChange={(e) => update("month", Number(e.target.value))}
            className={fieldClasses}
          >
            {MONTH_NAMES.map((name, i) => (
              <option key={name} value={i + 1}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClasses}>Year *</label>
          <input
            required
            type="number"
            value={values.year}
            onChange={(e) => update("year", Number(e.target.value))}
            className={fieldClasses}
          />
        </div>
      </div>
      <div>
        <label className={labelClasses}>Amount (BDT) *</label>
        <input
          required
          type="number"
          min={0}
          value={values.amountBDT}
          onChange={(e) => update("amountBDT", e.target.value)}
          className={fieldClasses}
        />
      </div>
      <div>
        <label className={labelClasses}>Note</label>
        <textarea rows={2} value={values.note} onChange={(e) => update("note", e.target.value)} className={fieldClasses} />
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex justify-end gap-3 border-t border-brown-600/10 pt-4">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" size="sm" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Record Payment"}
        </Button>
      </div>
    </form>
  );
}
