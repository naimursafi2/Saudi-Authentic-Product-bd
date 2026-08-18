"use client";

import { useEffect, useState } from "react";
import { ScrollText } from "lucide-react";
import { listAuditLogs } from "@/lib/api/auditLogs";
import { useAuth } from "@/context/AuthContext";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState, TableSkeleton, ErrorState } from "@/components/admin/EmptyState";
import { AdminPagination } from "@/components/admin/AdminPagination";
import type { ApiAuditLog, Pagination } from "@/types/api";

function actorName(actor: ApiAuditLog["actor"]): string {
  return typeof actor === "string" ? actor : actor.name;
}

export default function AdminAuditLogsPage() {
  const { user } = useAuth();
  const seesEveryone = user?.role === "admin" || user?.role === "super_admin";

  const [logs, setLogs] = useState<ApiAuditLog[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setIsLoading(true);
    listAuditLogs({ page, limit: 30 })
      .then(({ data, pagination: pg }) => {
        setLogs(data.logs);
        setPagination(pg ?? null);
        setError(null);
      })
      .catch(() => setError("Could not load audit logs."))
      .finally(() => setIsLoading(false));
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(load, [page]);

  return (
    <div>
      <PageHeader
        title="Audit Logs"
        description={
          seesEveryone
            ? "Read-only history of sensitive actions across the platform."
            : "Read-only history of your own actions."
        }
      />

      {isLoading ? (
        <TableSkeleton />
      ) : error ? (
        <ErrorState message={error} />
      ) : logs.length === 0 ? (
        <EmptyState icon={ScrollText} title="No activity yet" description="Sensitive actions will appear here." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-brown-600/10 bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-brown-600/10 text-xs uppercase tracking-wide text-brown-500">
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Resource</th>
                <th className="px-4 py-3">By</th>
                <th className="px-4 py-3">Note</th>
                <th className="px-4 py-3">When</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log._id} className="border-b border-brown-600/10 last:border-none">
                  <td className="px-4 py-3 font-mono text-xs font-medium text-green-950">{log.action}</td>
                  <td className="px-4 py-3 text-brown-600">
                    {log.resource}
                    {log.resourceId && <span className="text-xs text-brown-500"> #{log.resourceId.slice(-6)}</span>}
                  </td>
                  <td className="px-4 py-3 text-brown-600">
                    {actorName(log.actor)} <span className="text-xs capitalize text-brown-500">({log.actorRole})</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-brown-500">{log.note ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-brown-500">{new Date(log.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 pb-4">
            <AdminPagination pagination={pagination} onPageChange={setPage} />
          </div>
        </div>
      )}
    </div>
  );
}
