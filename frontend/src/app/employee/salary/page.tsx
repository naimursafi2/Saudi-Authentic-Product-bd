"use client";

import { useEffect, useState } from "react";
import { Wallet } from "lucide-react";
import { listMySalaryPayments } from "@/lib/api/salary";
import { formatBDT } from "@/lib/utils";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState, TableSkeleton, ErrorState } from "@/components/admin/EmptyState";
import { StatusBadge } from "@/components/admin/StatusBadge";
import type { ApiSalaryPayment } from "@/types/hr";

export default function EmployeeSalaryPage() {
  const [payments, setPayments] = useState<ApiSalaryPayment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true);
    listMySalaryPayments(1, 30)
      .then(({ data }) => {
        setPayments(data.payments);
        setError(null);
      })
      .catch(() => setError("Could not load your salary history."))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div>
      <PageHeader title="Salary" description="Your monthly payment history." />

      {isLoading ? (
        <TableSkeleton />
      ) : error ? (
        <ErrorState message={error} />
      ) : payments.length === 0 ? (
        <EmptyState icon={Wallet} title="No salary records yet" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-brown-600/10 bg-white shadow-[0_1px_2px_rgba(61,43,31,0.04)]">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-brown-600/10 bg-cream-200/40 text-xs uppercase tracking-wide text-brown-500">
                <th className="px-5 py-3.5">Month</th>
                <th className="px-5 py-3.5">Amount</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Paid On</th>
                <th className="px-5 py-3.5">Note</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p._id} className="border-b border-brown-600/10 transition-colors last:border-none hover:bg-cream-100/60">
                  <td className="px-5 py-3.5 font-medium text-green-950">
                    {new Date(p.year, p.month - 1).toLocaleString("en-US", { month: "long", year: "numeric" })}
                  </td>
                  <td className="px-5 py-3.5 font-semibold text-green-950">{formatBDT(p.amountBDT)}</td>
                  <td className="px-5 py-3.5">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="px-5 py-3.5 text-brown-600">
                    {p.paidAt ? new Date(p.paidAt).toLocaleDateString("en-GB") : "—"}
                  </td>
                  <td className="px-5 py-3.5 text-brown-500">{p.note ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
