"use client";

import { useEffect, useState } from "react";
import { Plus, Store, Pencil, Trash2, Users } from "lucide-react";
import { assignShops, createShop, deleteShop, listShops, updateShop } from "@/lib/api/shops";
import { listUsers } from "@/lib/api/users";
import { ApiClientError } from "@/lib/api/client";
import { useAuth } from "@/context/AuthContext";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState, TableSkeleton, ErrorState } from "@/components/admin/EmptyState";
import { Modal } from "@/components/admin/Modal";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Button } from "@/components/ui/Button";
import type { ApiShop, ApiUser } from "@/types/api";

const fieldClasses =
  "w-full rounded border border-green-900/15 bg-cream-50 px-3 py-2 text-sm text-green-950 placeholder:text-brown-500/50 focus:border-green-900/40 focus:outline-none";
const labelClasses = "mb-1 block text-xs font-bold uppercase tracking-[0.06em] text-brown-600";

/** Roles whose purchase access is scoped by shop assignment. */
const ASSIGNABLE_ROLES = ["co_admin", "order_manager", "employee"] as const;

export default function AdminShopsPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission("shops.manage");

  const [shops, setShops] = useState<ApiShop[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [editing, setEditing] = useState<ApiShop | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [assigning, setAssigning] = useState(false);

  function load() {
    setIsLoading(true);
    listShops({ includeInactive: true })
      .then(({ data }) => {
        setShops(data.shops);
        setError(null);
      })
      .catch(() => setError("Could not load shops."))
      .finally(() => setIsLoading(false));
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(load, []);

  async function handleDelete(shop: ApiShop) {
    if (!confirm(`Delete "${shop.name}"? This only works while no purchases reference it.`)) return;
    setActionError(null);
    try {
      await deleteShop(shop._id);
      load();
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.message : "Could not delete shop.");
    }
  }

  return (
    <div>
      <PageHeader
        title="Shops"
        description="Sourcing outlets that purchase batches belong to. Staff only see purchases for the shops assigned to them."
        action={
          canManage ? (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setAssigning(true)}>
                <Users size={14} /> Assign Staff
              </Button>
              <Button variant="primary" size="sm" onClick={() => setIsCreating(true)}>
                <Plus size={14} /> Add Shop
              </Button>
            </div>
          ) : undefined
        }
      />

      {actionError && <p className="mb-4 text-sm text-danger">{actionError}</p>}

      {isLoading ? (
        <TableSkeleton />
      ) : error ? (
        <ErrorState message={error} />
      ) : shops.length === 0 ? (
        <EmptyState
          icon={Store}
          title="No shops yet"
          description="Add a shop before recording purchases against it."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-brown-600/10 bg-surface">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-brown-600/10 text-xs uppercase tracking-wide text-brown-500">
                <th className="px-4 py-3">Shop</th>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {shops.map((shop) => (
                <tr key={shop._id} className="border-b border-brown-600/10 last:border-none">
                  <td className="px-4 py-3 font-medium text-green-950">{shop.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-brown-600">{shop.code}</td>
                  <td className="px-4 py-3 text-brown-600">{shop.location ?? "-"}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={shop.isActive ? "active" : "inactive"} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {canManage && (
                      <div className="flex justify-end gap-3">
                        <button
                          aria-label="Edit"
                          onClick={() => setEditing(shop)}
                          className="cursor-pointer text-brown-600 hover:text-green-950"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          aria-label="Delete"
                          onClick={() => handleDelete(shop)}
                          className="cursor-pointer text-danger hover:text-danger-strong"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(isCreating || editing) && (
        <ShopForm
          shop={editing}
          onClose={() => {
            setIsCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setIsCreating(false);
            setEditing(null);
            load();
          }}
        />
      )}

      {assigning && <AssignShopsModal shops={shops} onClose={() => setAssigning(false)} />}
    </div>
  );
}

function ShopForm({
  shop,
  onClose,
  onSaved,
}: {
  shop: ApiShop | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(shop?.name ?? "");
  const [code, setCode] = useState(shop?.code ?? "");
  const [location, setLocation] = useState(shop?.location ?? "");
  const [note, setNote] = useState(shop?.note ?? "");
  const [isActive, setIsActive] = useState(shop?.isActive ?? true);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);
    try {
      const payload = {
        name,
        code,
        location: location || undefined,
        note: note || undefined,
        isActive,
      };
      if (shop) await updateShop(shop._id, payload);
      else await createShop(payload);
      onSaved();
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.message : "Could not save shop.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal title={shop ? "Edit Shop" : "Add Shop"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className={labelClasses}>Shop name *</label>
          <input required value={name} onChange={(e) => setName(e.target.value)} className={fieldClasses} />
        </div>
        <div>
          <label className={labelClasses}>Code *</label>
          <input
            required
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="MADINAH-1"
            className={fieldClasses}
          />
        </div>
        <div>
          <label className={labelClasses}>Location</label>
          <input value={location} onChange={(e) => setLocation(e.target.value)} className={fieldClasses} />
        </div>
        <div>
          <label className={labelClasses}>Note</label>
          <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} className={fieldClasses} />
        </div>
        <label className="flex items-center gap-2 text-sm text-green-950">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          Active (new purchases can be recorded against this shop)
        </label>

        {formError && <p className="text-sm text-danger">{formError}</p>}

        <div className="flex justify-end gap-3 border-t border-brown-600/10 pt-4">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : shop ? "Save Changes" : "Add Shop"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Assignment is stored per user (`User.assignedShops`), so this picks a staff
 * member first and then edits their whole shop list at once.
 */
function AssignShopsModal({ shops, onClose }: { shops: ApiShop[]; onClose: () => void }) {
  const [staff, setStaff] = useState<ApiUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedShops, setSelectedShops] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all(ASSIGNABLE_ROLES.map((role) => listUsers({ role, limit: 100 })))
      .then((results) => setStaff(results.flatMap(({ data }) => data.users)))
      .catch(() => setFormError("Could not load staff accounts."))
      .finally(() => setIsLoading(false));
  }, []);

  function pickUser(userId: string) {
    setSelectedUserId(userId);
    setMessage(null);
    const user = staff.find((candidate) => candidate._id === userId);
    setSelectedShops((user?.assignedShops ?? []).map((shop) => (typeof shop === "string" ? shop : shop._id)));
  }

  function toggleShop(shopId: string) {
    setSelectedShops((current) =>
      current.includes(shopId) ? current.filter((id) => id !== shopId) : [...current, shopId]
    );
  }

  async function handleSave() {
    if (!selectedUserId) return;
    setIsSaving(true);
    setFormError(null);
    try {
      const { data } = await assignShops(selectedUserId, selectedShops);
      setStaff((current) =>
        current.map((user) =>
          user._id === selectedUserId ? { ...user, assignedShops: data.user.assignedShops } : user
        )
      );
      setMessage("Shop assignment saved.");
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.message : "Could not save assignment.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal title="Assign Shops to Staff" onClose={onClose} wide>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-brown-600">
          A staff member with no assigned shop sees an empty purchase list. Roles that can manage shops
          (Admin, Super Admin) always see every shop and are not listed here.
        </p>

        <div>
          <label className={labelClasses}>Staff member</label>
          <select
            value={selectedUserId}
            onChange={(e) => pickUser(e.target.value)}
            disabled={isLoading}
            className={fieldClasses}
          >
            <option value="">{isLoading ? "Loading..." : "Select a staff member"}</option>
            {staff.map((user) => (
              <option key={user._id} value={user._id}>
                {user.name} ({user.role.replace(/_/g, " ")})
              </option>
            ))}
          </select>
        </div>

        {selectedUserId && (
          <div className="rounded border border-brown-600/10 p-3">
            <p className={labelClasses}>Shops</p>
            {shops.length === 0 ? (
              <p className="text-sm text-brown-600">Add a shop first.</p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {shops.map((shop) => (
                  <label key={shop._id} className="flex items-center gap-2 text-sm text-green-950">
                    <input
                      type="checkbox"
                      checked={selectedShops.includes(shop._id)}
                      onChange={() => toggleShop(shop._id)}
                    />
                    {shop.name}
                    <span className="font-mono text-xs text-brown-500">{shop.code}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {message && <p className="text-sm text-green-900">{message}</p>}
        {formError && <p className="text-sm text-danger">{formError}</p>}

        <div className="flex justify-end gap-3 border-t border-brown-600/10 pt-4">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={!selectedUserId || isSaving}
            onClick={handleSave}
          >
            {isSaving ? "Saving..." : "Save Assignment"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
