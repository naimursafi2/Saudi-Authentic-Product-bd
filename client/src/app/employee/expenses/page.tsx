"use client";

import { ExpensesManager } from "@/components/finance/ExpensesManager";

/**
 * Read-only for an Employee (no `expenses.create`/`expenses.approve`/
 * `expenses.edit`) — the "Request Edit" action is the only write path this
 * portal offers, gated by `expenses.requestEdit`. Same shared component
 * `/admin/expenses` uses; every capability difference between the two
 * portals comes entirely from the signed-in user's actual permissions, not
 * a prop here.
 */
export default function EmployeeExpensesPage() {
  return <ExpensesManager />;
}
