"use client";

import { useState } from "react";
import { MapPin, Plus, Trash2 } from "lucide-react";
import { addAddress, removeAddress } from "@/lib/api/users";
import { ApiClientError } from "@/lib/api/client";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import type { ApiAddress } from "@/types/api";

const fieldClasses =
  "w-full rounded border border-green-900/15 bg-cream-50 px-3.5 py-2.5 text-sm text-green-950 placeholder:text-brown-500/50 focus:border-green-900/40 focus:outline-none";

export function AddressBook({ addresses }: { addresses: ApiAddress[] }) {
  const { refreshUser } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    setIsSubmitting(true);
    try {
      await addAddress({
        label: String(form.get("label") ?? ""),
        fullAddress: String(form.get("fullAddress") ?? ""),
        district: String(form.get("district") ?? ""),
        cityArea: String(form.get("cityArea") ?? ""),
        phone: String(form.get("phone") ?? ""),
        isDefault: addresses.length === 0,
      });
      await refreshUser();
      setShowForm(false);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not save address.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRemove(addressId: string) {
    setRemovingId(addressId);
    try {
      await removeAddress(addressId);
      await refreshUser();
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {addresses.length === 0 && !showForm && (
        <p className="text-sm text-brown-500">You haven&apos;t saved any addresses yet.</p>
      )}

      <div className="flex flex-col gap-3">
        {addresses.map((address) => (
          <div
            key={address._id}
            className="flex items-start justify-between gap-4 rounded-lg border border-brown-600/10 bg-white p-5"
          >
            <div className="flex gap-3">
              <MapPin size={18} className="mt-0.5 shrink-0 text-brown-500" />
              <div>
                <p className="text-sm font-semibold text-green-950">
                  {address.label}
                  {address.isDefault && (
                    <span className="ml-2 rounded-full bg-cream-300 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brown-600">
                      Default
                    </span>
                  )}
                </p>
                <p className="text-sm text-brown-500">
                  {address.fullAddress}, {address.cityArea}, {address.district}
                </p>
                <p className="text-xs text-brown-500">{address.phone}</p>
              </div>
            </div>
            <button
              aria-label="Remove address"
              onClick={() => handleRemove(address._id)}
              disabled={removingId === address._id}
              className="shrink-0 text-brown-500/70 hover:text-[#8a4a3f] disabled:opacity-50"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>

      {showForm ? (
        <form
          onSubmit={handleAdd}
          className="flex flex-col gap-4 rounded-lg border border-brown-600/10 bg-white p-6"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <input name="label" required placeholder="Label (e.g. Home)" className={fieldClasses} />
            <input name="phone" required placeholder="Phone" className={fieldClasses} />
            <input
              name="fullAddress"
              required
              placeholder="Full Address"
              className={`sm:col-span-2 ${fieldClasses}`}
            />
            <input name="district" required placeholder="District" className={fieldClasses} />
            <input name="cityArea" required placeholder="City / Area" className={fieldClasses} />
          </div>
          {error && <p className="text-sm text-[#8a4a3f]">{error}</p>}
          <div className="flex gap-3">
            <Button type="submit" variant="primary" size="sm" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Address"}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Button variant="outline" size="sm" className="self-start" onClick={() => setShowForm(true)}>
          <Plus size={14} /> Add Address
        </Button>
      )}
    </div>
  );
}
