"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { UploadCloud } from "lucide-react";
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
  joinedAt: string;
  nidNumber: string;
  isActive: boolean;
}

/** `<input type="date">` wants `YYYY-MM-DD`; `toISOString()` includes the time. */
function toDateInputValue(iso?: string): string {
  return iso ? iso.slice(0, 10) : "";
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
      joinedAt: toDateInputValue(new Date().toISOString()),
      nidNumber: "",
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
    joinedAt: toDateInputValue(user.staffMeta?.joinedAt ?? user.createdAt),
    nidNumber: user.staffMeta?.nidNumber ?? "",
    isActive: user.isActive,
  };
}

function NidImageUploader({
  user,
  onUpload,
}: {
  user: ApiUser;
  onUpload: (file: File) => Promise<void>;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setIsUploading(true);
    try {
      await onUpload(file);
    } catch {
      setError("Could not upload the NID image.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div>
      <label className={labelClasses}>NID Card Image</label>
      <div className="flex items-center gap-3">
        {user.staffMeta?.nidImage?.url ? (
          <span className="relative block h-16 w-24 overflow-hidden rounded border border-green-900/15 bg-cream-50">
            <Image src={user.staffMeta.nidImage.url} alt="NID card" fill className="object-cover" />
          </span>
        ) : (
          <span className="flex h-16 w-24 items-center justify-center rounded border border-dashed border-brown-500/30 text-xs text-brown-500">
            No image
          </span>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          <UploadCloud size={14} /> {isUploading ? "Uploading..." : "Upload"}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileSelected}
        />
      </div>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}

export function EmployeeForm({
  initial,
  error,
  isSubmitting,
  onSubmit,
  onCancel,
  onUploadNidImage,
}: {
  initial?: ApiUser;
  error: string | null;
  isSubmitting: boolean;
  onSubmit: (values: EmployeeFormValues) => void;
  onCancel: () => void;
  /** Only meaningful in edit mode — a brand-new employee has no id to attach the image to yet. */
  onUploadNidImage?: (file: File) => Promise<void>;
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
        <div>
          <label className={labelClasses}>Joined Date</label>
          <input
            type="date"
            value={values.joinedAt}
            onChange={(e) => update("joinedAt", e.target.value)}
            className={fieldClasses}
          />
        </div>
        <div>
          <label className={labelClasses}>NID Number</label>
          <input
            value={values.nidNumber}
            onChange={(e) => update("nidNumber", e.target.value)}
            className={fieldClasses}
          />
        </div>
      </div>

      {isEdit && initial && onUploadNidImage && (
        <NidImageUploader user={initial} onUpload={onUploadNidImage} />
      )}

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
