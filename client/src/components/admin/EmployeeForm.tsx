"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { ApiUser } from "@/types/api";

const fieldClasses =
  "w-full rounded border border-green-900/15 bg-cream-50 px-3 py-2 text-sm text-green-950 placeholder:text-brown-500/50 focus:border-green-900/40 focus:outline-none";
const labelClasses = "mb-1 block text-xs font-bold uppercase tracking-[0.06em] text-brown-600";

export type StaffRole = "employee" | "delivery_agent" | "co_admin" | "order_manager" | "admin";
const STAFF_ROLE_OPTIONS: StaffRole[] = ["employee", "delivery_agent", "co_admin", "order_manager", "admin"];

export interface EmployeeFormValues {
  name: string;
  email: string;
  password: string;
  phone: string;
  role: StaffRole;
  employeeId: string;
  department: string;
  designation: string;
  baseSalaryBDT: string;
  isActive: boolean;
}

function fromUser(user?: ApiUser): EmployeeFormValues {
  if (!user) {
    return {
      name: "",
      email: "",
      password: "",
      phone: "",
      role: "employee",
      employeeId: "",
      department: "",
      designation: "",
      baseSalaryBDT: "",
      isActive: true,
    };
  }
  return {
    name: user.name,
    email: user.email,
    password: "",
    phone: user.phone ?? "",
    role: (["co_admin", "order_manager", "admin", "delivery_agent"].includes(user.role)
      ? user.role
      : "employee") as StaffRole,
    employeeId: user.staffMeta?.employeeId ?? "",
    department: user.staffMeta?.department ?? "",
    designation: user.staffMeta?.designation ?? "",
    baseSalaryBDT: user.staffMeta?.baseSalaryBDT != null ? String(user.staffMeta.baseSalaryBDT) : "",
    isActive: user.isActive,
  };
}

export function EmployeeForm({
  initial,
  error,
  isSubmitting,
  onSubmit,
  onCancel,
}: {
  initial?: ApiUser;
  error: string | null;
  isSubmitting: boolean;
  onSubmit: (values: EmployeeFormValues) => void;
  onCancel: () => void;
}) {
  const isEdit = Boolean(initial);
  const [values, setValues] = useState<EmployeeFormValues>(() => fromUser(initial));

  function update<K extends keyof EmployeeFormValues>(key: K, value: EmployeeFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {!isEdit && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClasses}>Name *</label>
            <input required value={values.name} onChange={(e) => update("name", e.target.value)} className={fieldClasses} />
          </div>
          <div>
            <label className={labelClasses}>Email *</label>
            <input
              required
              type="email"
              value={values.email}
              onChange={(e) => update("email", e.target.value)}
              className={fieldClasses}
            />
          </div>
          <div>
            <label className={labelClasses}>Password *</label>
            <input
              required
              type="password"
              minLength={8}
              value={values.password}
              onChange={(e) => update("password", e.target.value)}
              className={fieldClasses}
            />
          </div>
          <div>
            <label className={labelClasses}>Phone</label>
            <input value={values.phone} onChange={(e) => update("phone", e.target.value)} className={fieldClasses} />
          </div>
          <div>
            <label className={labelClasses}>Employee ID *</label>
            <input
              required
              value={values.employeeId}
              onChange={(e) => update("employeeId", e.target.value)}
              className={fieldClasses}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClasses}>Role *</label>
          <select value={values.role} onChange={(e) => update("role", e.target.value as StaffRole)} className={fieldClasses}>
            {STAFF_ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>
        {isEdit && (
          <div>
            <label className={labelClasses}>Status</label>
            <select
              value={values.isActive ? "active" : "inactive"}
              onChange={(e) => update("isActive", e.target.value === "active")}
              className={fieldClasses}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        )}
        <div>
          <label className={labelClasses}>Department</label>
          <input value={values.department} onChange={(e) => update("department", e.target.value)} className={fieldClasses} />
        </div>
        <div>
          <label className={labelClasses}>Designation</label>
          <input
            value={values.designation}
            onChange={(e) => update("designation", e.target.value)}
            className={fieldClasses}
          />
        </div>
        <div>
          <label className={labelClasses}>Base Salary (BDT)</label>
          <input
            type="number"
            min={0}
            value={values.baseSalaryBDT}
            onChange={(e) => update("baseSalaryBDT", e.target.value)}
            className={fieldClasses}
          />
        </div>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex justify-end gap-3 border-t border-brown-600/10 pt-4">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" size="sm" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : isEdit ? "Save Changes" : "Add Employee"}
        </Button>
      </div>
    </form>
  );
}
