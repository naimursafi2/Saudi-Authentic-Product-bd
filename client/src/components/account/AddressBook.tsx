"use client";

import { useState } from "react";
import { MapPin, Pencil, Phone, Plus, Star, Trash2 } from "lucide-react";
import { addAddress, removeAddress, updateAddress } from "@/lib/api/users";
import { ApiClientError } from "@/lib/api/client";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { Tooltip } from "@/components/ui/Tooltip";
import { cn } from "@/lib/utils";
import type { ApiAddress } from "@/types/api";

const fieldClasses =
  "w-full rounded border border-green-900/15 bg-cream-50 px-3.5 py-2.5 text-sm text-green-950 placeholder:text-brown-500/50 focus:border-green-900/40 focus:outline-none";

function AddressForm({
  initial,
  onCancel,
  onSubmit,
  isSubmitting,
  error,
  submitLabel,
}: {
  initial?: Partial<ApiAddress>;
  onCancel: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  isSubmitting: boolean;
  error: string | null;
  submitLabel: string;
}) {
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 rounded-xl border border-brown-600/10 bg-surface p-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <input
          name="label"
          required
          defaultValue={initial?.label}
          placeholder="Label (e.g. Home)"
          className={fieldClasses}
        />
        <input name="phone" required defaultValue={initial?.phone} placeholder="Phone" className={fieldClasses} />
        <input
          name="fullAddress"
          required
          defaultValue={initial?.fullAddress}
          placeholder="Full Address"
          className={`sm:col-span-2 ${fieldClasses}`}
        />
        <input
          name="district"
          required
          defaultValue={initial?.district}
          placeholder="District"
          className={fieldClasses}
        />
        <input
          name="cityArea"
          required
          defaultValue={initial?.cityArea}
          placeholder="City / Area"
          className={fieldClasses}
        />
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex gap-3">
        <Button type="submit" variant="primary" size="sm" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : submitLabel}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function AddressBook({ addresses }: { addresses: ApiAddress[] }) {
  const { refreshUser } = useAuth();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function readForm(form: HTMLFormElement) {
    const data = new FormData(form);
    return {
      label: String(data.get("label") ?? ""),
      fullAddress: String(data.get("fullAddress") ?? ""),
      district: String(data.get("district") ?? ""),
      cityArea: String(data.get("cityArea") ?? ""),
      phone: String(data.get("phone") ?? ""),
    };
  }

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await addAddress({ ...readForm(e.currentTarget), isDefault: addresses.length === 0 });
      await refreshUser();
      setShowAddForm(false);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not save address.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleEdit(e: React.FormEvent<HTMLFormElement>, addressId: string) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await updateAddress(addressId, readForm(e.currentTarget));
      await refreshUser();
      setEditingId(null);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not update address.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSetDefault(addressId: string) {
    setBusyId(addressId);
    try {
      await updateAddress(addressId, { isDefault: true });
      await refreshUser();
    } finally {
      setBusyId(null);
    }
  }

  async function handleRemove(addressId: string) {
    setBusyId(addressId);
    try {
      await removeAddress(addressId);
      await refreshUser();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {addresses.length === 0 && !showAddForm && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-brown-500/30 bg-surface py-16 text-center">
          <MapPin size={28} className="text-brown-500/40" />
          <p className="text-sm text-brown-500">You haven&apos;t saved any addresses yet.</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {addresses.map((address) =>
          editingId === address._id ? (
            <div key={address._id} className="sm:col-span-2">
              <AddressForm
                initial={address}
                onCancel={() => setEditingId(null)}
                onSubmit={(e) => handleEdit(e, address._id)}
                isSubmitting={isSubmitting}
                error={error}
                submitLabel="Save Changes"
              />
            </div>
          ) : (
            <div
              key={address._id}
              className={cn(
                "flex flex-col gap-3 rounded-xl border bg-surface p-5 transition-shadow hover:shadow-md",
                address.isDefault ? "border-gold-500/50" : "border-brown-600/10"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-green-950/5 text-green-900">
                    <MapPin size={16} />
                  </span>
                  <p className="text-sm font-semibold text-green-950">{address.label}</p>
                  {address.isDefault && (
                    <span className="flex items-center gap-1 rounded-full bg-gold-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gold-700">
                      <Star size={9} className="fill-gold-600 text-gold-600" /> Default
                    </span>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Tooltip label="Edit address">
                    <button
                      aria-label="Edit address"
                      onClick={() => {
                        setError(null);
                        setShowAddForm(false);
                        setEditingId(address._id);
                      }}
                      className="inline-flex cursor-pointer items-center justify-center rounded-full bg-info-soft p-1.5 text-info transition-colors duration-150 hover:bg-info-soft-hover"
                    >
                      <Pencil size={14} />
                    </button>
                  </Tooltip>
                  <Tooltip label="Remove address">
                    <button
                      aria-label="Remove address"
                      onClick={() => handleRemove(address._id)}
                      disabled={busyId === address._id}
                      className="inline-flex cursor-pointer items-center justify-center rounded-full bg-danger-soft p-1.5 text-danger transition-colors duration-150 hover:bg-danger-soft-hover disabled:opacity-50"
                    >
                      <Trash2 size={14} />
                    </button>
                  </Tooltip>
                </div>
              </div>
              <p className="text-sm text-brown-600">
                {address.fullAddress}, {address.cityArea}, {address.district}
              </p>
              <p className="flex items-center gap-1.5 text-xs text-brown-500">
                <Phone size={12} /> {address.phone}
              </p>
              {!address.isDefault && (
                <button
                  onClick={() => handleSetDefault(address._id)}
                  disabled={busyId === address._id}
                  className="cursor-pointer self-start text-xs font-bold uppercase tracking-[0.06em] text-green-900 hover:text-green-950 disabled:opacity-50"
                >
                  Set as Default
                </button>
              )}
            </div>
          )
        )}
      </div>

      {showAddForm ? (
        <AddressForm
          onCancel={() => setShowAddForm(false)}
          onSubmit={handleAdd}
          isSubmitting={isSubmitting}
          error={error}
          submitLabel="Save Address"
        />
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => {
            setError(null);
            setEditingId(null);
            setShowAddForm(true);
          }}
        >
          <Plus size={14} /> Add Address
        </Button>
      )}
    </div>
  );
}
