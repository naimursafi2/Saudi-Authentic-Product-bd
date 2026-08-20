"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Users, Search } from "lucide-react";
import { impersonateUser, listUsers, unlockUser, updateUserStatus } from "@/lib/api/users";
import { ApiClientError } from "@/lib/api/client";
import { useAuth } from "@/context/AuthContext";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState, TableSkeleton, ErrorState } from "@/components/admin/EmptyState";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Button } from "@/components/ui/Button";
import type { ApiUser, Pagination } from "@/types/api";

function isLocked(user: ApiUser): boolean {
  return Boolean(user.lockedUntil && new Date(user.lockedUntil).getTime() > Date.now());
}

export default function AdminCustomersPage() {
  const { user, startImpersonation } = useAuth();
  const router = useRouter();
  const canManageStatus = user?.role !== "co_admin";
  const canImpersonate = user?.role === "super_admin";
  const [actionError, setActionError] = useState<string | null>(null);

  const [customers, setCustomers] = useState<ApiUser[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  function load() {
    setIsLoading(true);
    listUsers({ role: "customer", search: debouncedSearch || undefined, page, limit: 20 })
      .then(({ data, pagination: pg }) => {
        setCustomers(data.users);
        setPagination(pg ?? null);
        setError(null);
      })
      .catch(() => setError("Could not load customers."))
      .finally(() => setIsLoading(false));
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(load, [page, debouncedSearch]);

  async function handleToggleStatus(customer: ApiUser) {
    const action = customer.isActive ? "deactivate" : "reactivate";
    if (!confirm(`Are you sure you want to ${action} ${customer.name}'s account?`)) return;
    setUpdatingId(customer._id);
    try {
      await updateUserStatus(customer._id, !customer.isActive);
      load();
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleUnlock(customer: ApiUser) {
    setActionError(null);
    setUpdatingId(customer._id);
    try {
      await unlockUser(customer._id);
      load();
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.message : "Could not unlock this account.");
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleImpersonate(customer: ApiUser) {
    if (!confirm(`Sign in as ${customer.name}? This is recorded in the audit log.`)) return;
    setActionError(null);
    setUpdatingId(customer._id);
    try {
      const { data } = await impersonateUser(customer._id);
      await startImpersonation(data.accessToken);
      router.push("/account");
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.message : "Could not start a support login.");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div>
      <PageHeader title="Customers" description="Browse registered customers and manage account access." />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brown-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="h-9 w-full rounded border border-brown-600/20 bg-surface pl-8 pr-3 text-sm text-green-950 placeholder:text-brown-500/60 focus:outline-none focus:ring-1 focus:ring-green-900/30"
          />
        </div>
      </div>

      {actionError && <p className="mb-4 text-sm text-danger">{actionError}</p>}

      {isLoading ? (
        <TableSkeleton />
      ) : error ? (
        <ErrorState message={error} />
      ) : customers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No customers found"
          description="Registered customers will show up here."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-brown-600/10 bg-surface">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-brown-600/10 text-xs uppercase tracking-wide text-brown-500">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Addresses</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3">Status</th>
                {(canManageStatus || canImpersonate) && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer._id} className="border-b border-brown-600/10 last:border-none">
                  <td className="px-4 py-3 font-medium text-green-950">{customer.name}</td>
                  <td className="px-4 py-3 text-brown-600">{customer.email}</td>
                  <td className="px-4 py-3 text-brown-600">{customer.phone ?? "—"}</td>
                  <td className="px-4 py-3 text-brown-600">{customer.addresses.length}</td>
                  <td className="px-4 py-3 text-brown-600">
                    {new Date(customer.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <StatusBadge status={customer.isActive ? "active" : "inactive"} />
                      {isLocked(customer) && (
                        <span className="rounded-full bg-danger-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-danger">
                          Locked
                        </span>
                      )}
                    </div>
                  </td>
                  {(canManageStatus || canImpersonate) && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        {canManageStatus && isLocked(customer) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={updatingId === customer._id}
                            onClick={() => handleUnlock(customer)}
                          >
                            Unlock
                          </Button>
                        )}
                        {canImpersonate && customer.isActive && (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={updatingId === customer._id}
                            onClick={() => handleImpersonate(customer)}
                          >
                            Sign in as
                          </Button>
                        )}
                        {canManageStatus && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={updatingId === customer._id}
                            onClick={() => handleToggleStatus(customer)}
                          >
                            {updatingId === customer._id
                              ? "Updating..."
                              : customer.isActive
                                ? "Deactivate"
                                : "Reactivate"}
                          </Button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AdminPagination pagination={pagination} onPageChange={setPage} />
    </div>
  );
}
