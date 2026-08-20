"use client";

import { useEffect, useState } from "react";
import { Plus, Wallet } from "lucide-react";
import { createSalaryPayment, listSalaryPayments, updateSalaryStatus, notifySalaryPayment } from "@/lib/api/salary";
import { listUsers } from "@/lib/api/users";
import { ApiClientError } from "@/lib/api/client";
import { useAuth } from "@/context/AuthContext";
import { formatBDT } from "@/lib/utils";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState, TableSkeleton, ErrorState } from "@/components/admin/EmptyState";
import { Modal } from "@/components/admin/Modal";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { Button } from "@/components/ui/Button";
import { SalaryPaymentForm, MONTH_NAMES, type SalaryPaymentFormValues } from "@/components/admin/SalaryPaymentForm";
import type { ApiSalaryPayment } from "@/types/hr";
import type { ApiUser, Pagination } from "@/types/api";

function personName(person: string | { name: string }): string {
  return typeof person === "string" ? person : person.name;
}

export default function AdminSalaryPage() {
  const { user } = useAuth();
  const isRestricted = user?.role === "co_admin";

  const [payments, setPayments] = useState<ApiSalaryPayment[]>([]);
  const [employees, setEmployees] = useState<ApiUser[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [justNotifiedId, setJustNotifiedId] = useState<string | null>(null);

  function load() {
    setIsLoading(true);
    listSalaryPayments({ page, limit: 20 })
      .then(({ data, pagination: pg }) => {
        setPayments(data.payments);
        setPagination(pg ?? null);
        setError(null);
      })
      .catch(() => setError("Could not load salary payments."))
      .finally(() => setIsLoading(false));
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(load, [page]);

  useEffect(() => {
    listUsers({ role: "employee", limit: 100 })
      .then(({ data }) => setEmployees(data.users))
      .catch(() => {});
  }, []);

  async function handleSubmit(values: SalaryPaymentFormValues) {
    setFormError(null);
    setIsSubmitting(true);
    try {
      await createSalaryPayment({
        employee: values.employee,
        month: values.month,
        year: values.year,
        amountBDT: Number(values.amountBDT),
        note: values.note || undefined,
      });
      setIsCreating(false);
      load();
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.message : "Could not record payment.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleMarkPaid(payment: ApiSalaryPayment) {
    await updateSalaryStatus(payment._id, "paid");
    load();
  }

  async function handleRemind(payment: ApiSalaryPayment) {
    await notifySalaryPayment(payment._id);
    setJustNotifiedId(payment._id);
    setTimeout(() => setJustNotifiedId(null), 2000);
  }

  if (isRestricted) {
    return (
      <div>
        <PageHeader title="Salary & Payments" />
        <EmptyState
          icon={Wallet}
          title="Access restricted"
          description="Salary & Payments is available to Admin and Super Admin only."
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Salary & Payments"
        description="Record and track staff salary payments."
        action={
          <Button variant="primary" size="sm" onClick={() => setIsCreating(true)}>
            <Plus size={14} /> Record Payment
          </Button>
        }
      />

      {isLoading ? (
        <TableSkeleton />
      ) : error ? (
        <ErrorState message={error} />
      ) : payments.length === 0 ? (
        <EmptyState icon={Wallet} title="No payments recorded" description="Record your first salary payment to get started." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-brown-600/10 bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-brown-600/10 text-xs uppercase tracking-wide text-brown-500">
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Period</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment._id} className="border-b border-brown-600/10 last:border-none">
                  <td className="px-4 py-3 font-medium text-green-950">{personName(payment.employee)}</td>
                  <td className="px-4 py-3 text-brown-600">
                    {MONTH_NAMES[payment.month - 1]} {payment.year}
                  </td>
                  <td className="px-4 py-3 text-brown-600">{formatBDT(payment.amountBDT)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={payment.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      {payment.status === "pending" && (
                        <button
                          onClick={() => handleMarkPaid(payment)}
                          className="cursor-pointer text-xs font-bold uppercase tracking-wide text-green-900 hover:underline"
                        >
                          Mark Paid
                        </button>
                      )}
                      {justNotifiedId === payment._id ? (
                        <span className="text-xs font-bold uppercase tracking-wide text-green-900">Sent!</span>
                      ) : (
                        <button
                          onClick={() => handleRemind(payment)}
                          className="cursor-pointer text-xs font-bold uppercase tracking-wide text-brown-500 hover:text-green-950"
                        >
                          Send Reminder
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AdminPagination pagination={pagination} onPageChange={setPage} />

      {isCreating && (
        <Modal title="Record Payment" onClose={() => setIsCreating(false)}>
          <SalaryPaymentForm
            employees={employees}
            error={formError}
            isSubmitting={isSubmitting}
            onSubmit={handleSubmit}
            onCancel={() => setIsCreating(false)}
          />
        </Modal>
      )}
    </div>
  );
}
