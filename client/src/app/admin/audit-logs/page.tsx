"use client";

import { useEffect, useState } from "react";
import { ScrollText } from "lucide-react";
import { listAuditLogs } from "@/lib/api/auditLogs";
import { useAuth } from "@/context/AuthContext";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState, TableSkeleton, ErrorState } from "@/components/admin/EmptyState";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { ActionBadge, DebugId, actorName, friendlyNote, resourceLabel } from "@/lib/auditLogDisplay";
import type { ApiAuditLog, Pagination } from "@/types/api";

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
            ? "A plain-language history of sensitive actions across the platform."
            : "A plain-language history of your own actions."
        }
      />

      {isLoading ? (
        <TableSkeleton />
      ) : error ? (
        <ErrorState message={error} />
      ) : logs.length === 0 ? (
        <EmptyState icon={ScrollText} title="No activity yet" description="Sensitive actions will appear here." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-brown-600/10 bg-surface shadow-[0_1px_2px_rgba(61,43,31,0.04)]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-brown-600/10 bg-cream-200/40 text-xs uppercase tracking-wide text-brown-500">
                  <th className="px-5 py-3.5">Action</th>
                  <th className="px-5 py-3.5">Resource</th>
                  <th className="px-5 py-3.5">By</th>
                  <th className="px-5 py-3.5">Note</th>
                  <th className="px-5 py-3.5">When</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const resource = resourceLabel(log);
                  return (
                    <tr
                      key={log._id}
                      className="border-b border-brown-600/10 transition-colors last:border-none hover:bg-cream-100/60"
                    >
                      <td className="px-5 py-3.5">
                        <ActionBadge action={log.action} />
                      </td>
                      <td className="px-5 py-3.5 text-green-950">
                        <span className="font-medium">{resource.name ?? resource.type}</span>
                        {resource.name && <span className="ml-1.5 text-xs text-brown-500">({resource.type})</span>}
                        <DebugId id={log.resourceId} />
                      </td>
                      <td className="px-5 py-3.5 text-brown-600">
                        {actorName(log.actor)}{" "}
                        <span className="text-xs capitalize text-brown-500">({log.actorRole.replace(/_/g, " ")})</span>
                      </td>
                      <td className="max-w-xs px-5 py-3.5 text-brown-600">{friendlyNote(log)}</td>
                      <td className="px-5 py-3.5 text-xs whitespace-nowrap text-brown-500">
                        {new Date(log.createdAt).toLocaleString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-5 pb-4">
            <AdminPagination pagination={pagination} onPageChange={setPage} />
          </div>
        </div>
      )}
    </div>
  );
}
