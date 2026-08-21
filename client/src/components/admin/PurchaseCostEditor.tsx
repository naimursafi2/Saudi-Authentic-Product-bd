"use client";

import { useState } from "react";
import { Plus, Trash2, Paperclip, Pencil, X } from "lucide-react";
import { addCostItem, removeCostItem, updateCostItem, type CostItemPayload } from "@/lib/api/purchases";
import { ApiClientError } from "@/lib/api/client";
import { formatBDT } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import type { ApiPurchase, ApiPurchaseCostItem } from "@/types/api";

const fieldClasses =
  "w-full rounded border border-green-900/15 bg-cream-50 px-3 py-2 text-sm text-green-950 placeholder:text-brown-500/50 focus:border-green-900/40 focus:outline-none";
const labelClasses = "mb-1 block text-xs font-bold uppercase tracking-[0.06em] text-brown-600";

/**
 * The cost list for one purchase.
 *
 * There is no dropdown of cost types here and there must never be one — the
 * cost's name is whatever the person recording it types, so a dates batch
 * ("Shipping", "Customs", "Transport") and a watch batch ("Parts", "Repair",
 * "Supplier Fee") both work with no code change. A purchase can carry any
 * number of these.
 */
export function PurchaseCostEditor({
  purchase,
  editable,
  onChange,
}: {
  purchase: ApiPurchase;
  editable: boolean;
  onChange: (purchase: ApiPurchase) => void;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRemove(item: ApiPurchaseCostItem) {
    if (!confirm(`Remove the "${item.name}" cost from this purchase?`)) return;
    setError(null);
    setBusyId(item._id);
    try {
      const { data } = await removeCostItem(purchase._id, item._id);
      onChange(data.purchase);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not remove this cost.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="rounded border border-brown-600/10">
      <div className="flex items-center justify-between border-b border-brown-600/10 px-4 py-3">
        <h3 className="text-xs font-bold uppercase tracking-[0.08em] text-brown-600">
          Additional costs ({purchase.costItems.length})
        </h3>
        {editable && !isAdding && (
          <Button variant="outline" size="sm" onClick={() => setIsAdding(true)}>
            <Plus size={14} /> Add Cost
          </Button>
        )}
      </div>

      {error && <p className="px-4 pt-3 text-sm text-danger">{error}</p>}

      {purchase.costItems.length === 0 && !isAdding ? (
        <p className="px-4 py-4 text-sm text-brown-600">
          No additional costs yet. Add anything this batch cost beyond the goods themselves.
        </p>
      ) : (
        <ul className="divide-y divide-brown-600/10">
          {purchase.costItems.map((item) =>
            editingId === item._id ? (
              <li key={item._id} className="px-4 py-3">
                <CostItemForm
                  initial={item}
                  submitLabel="Save Cost"
                  onCancel={() => setEditingId(null)}
                  onSubmit={async (payload) => {
                    const { data } = await updateCostItem(purchase._id, item._id, payload);
                    onChange(data.purchase);
                    setEditingId(null);
                  }}
                />
              </li>
            ) : (
              <li key={item._id} className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-medium text-green-950">{item.name}</p>
                  {item.note && <p className="mt-0.5 text-xs text-brown-600">{item.note}</p>}
                  {item.proof?.url && (
                    <a
                      href={item.proof.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-gold-700 hover:underline"
                    >
                      <Paperclip size={12} /> View receipt
                    </a>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-sm font-semibold text-green-950">{formatBDT(item.amountBDT)}</span>
                  {editable && (
                    <>
                      <button
                        aria-label="Edit cost"
                        onClick={() => setEditingId(item._id)}
                        className="cursor-pointer text-brown-600 hover:text-green-950"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        aria-label="Remove cost"
                        disabled={busyId === item._id}
                        onClick={() => handleRemove(item)}
                        className="cursor-pointer text-danger hover:text-danger-strong disabled:opacity-50"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              </li>
            )
          )}
        </ul>
      )}

      {isAdding && (
        <div className="border-t border-brown-600/10 px-4 py-3">
          <CostItemForm
            submitLabel="Add Cost"
            onCancel={() => setIsAdding(false)}
            onSubmit={async (payload) => {
              const { data } = await addCostItem(purchase._id, payload);
              onChange(data.purchase);
              setIsAdding(false);
            }}
          />
        </div>
      )}
    </div>
  );
}

/** Name + Amount + Note + optional proof image. That is the whole cost model. */
export function CostItemForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: Pick<ApiPurchaseCostItem, "name" | "amountBDT" | "note">;
  submitLabel: string;
  onSubmit: (payload: CostItemPayload) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [amount, setAmount] = useState(initial ? String(initial.amountBDT) : "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [proof, setProof] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await onSubmit({ name: name.trim(), amountBDT: Number(amount), note: note.trim() || undefined, proof });
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not save this cost.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClasses}>Cost name *</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Shipping, Customs, Repair..."
            className={fieldClasses}
          />
        </div>
        <div>
          <label className={labelClasses}>Amount (BDT) *</label>
          <input
            required
            type="number"
            min={0}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={fieldClasses}
          />
        </div>
      </div>
      <div>
        <label className={labelClasses}>Note</label>
        <input value={note} onChange={(e) => setNote(e.target.value)} className={fieldClasses} />
      </div>
      <div>
        <label className={labelClasses}>Proof / receipt image</label>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setProof(e.target.files?.[0] ?? null)}
          className="text-sm text-brown-600"
        />
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          <X size={14} /> Cancel
        </Button>
        <Button type="submit" variant="primary" size="sm" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
