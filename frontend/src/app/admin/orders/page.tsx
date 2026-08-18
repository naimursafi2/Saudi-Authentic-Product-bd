"use client";

import { useEffect, useState } from "react";
import { PackageSearch } from "lucide-react";
import { listOrders, getOrder, updateOrderStatus, assignAgent } from "@/lib/api/orders";
import { listUsers } from "@/lib/api/users";
import { ApiClientError } from "@/lib/api/client";
import { formatBDT } from "@/lib/utils";
import { ORDER_STATUSES, nextGenericStatuses, orderStatusLabel } from "@/lib/orderStatus";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState, TableSkeleton, ErrorState } from "@/components/admin/EmptyState";
import { Modal } from "@/components/admin/Modal";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Button } from "@/components/ui/Button";
import type { ApiOrder, ApiUser, OrderStatus, Pagination } from "@/types/api";

const STATUS_OPTIONS = ORDER_STATUSES;
const ASSIGNABLE_STATUSES: OrderStatus[] = ["ready_for_dispatch", "delivery_failed"];

function customerName(customer: ApiOrder["customer"]): string {
  return typeof customer === "string" ? customer : customer.name;
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "">("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);

  function load() {
    setIsLoading(true);
    listOrders({ status: statusFilter || undefined, page, limit: 20 })
      .then(({ data, pagination: pg }) => {
        setOrders(data.orders);
        setPagination(pg ?? null);
        setError(null);
      })
      .catch(() => setError("Could not load orders."))
      .finally(() => setIsLoading(false));
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(load, [page, statusFilter]);

  return (
    <div>
      <PageHeader title="Orders" description="View and manage all customer orders." />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as OrderStatus | "");
            setPage(1);
          }}
          className="h-9 rounded border border-brown-600/20 bg-white px-3 text-sm text-green-950 focus:outline-none focus:ring-1 focus:ring-green-900/30"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s} className="capitalize">
              {orderStatusLabel(s)}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <TableSkeleton />
      ) : error ? (
        <ErrorState message={error} />
      ) : orders.length === 0 ? (
        <EmptyState
          icon={PackageSearch}
          title="No orders found"
          description="Orders placed by customers will show up here."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-brown-600/10 bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-brown-600/10 text-xs uppercase tracking-wide text-brown-500">
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Items</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3">Placed</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order._id} className="border-b border-brown-600/10 last:border-none">
                  <td className="px-4 py-3 font-medium text-green-950">{order.orderNumber}</td>
                  <td className="px-4 py-3 text-brown-600">{customerName(order.customer)}</td>
                  <td className="px-4 py-3 text-brown-600">{order.items.length}</td>
                  <td className="px-4 py-3 text-brown-600">{formatBDT(order.totalBDT)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={order.status} />
                  </td>
                  <td className="px-4 py-3 text-brown-600 uppercase">{order.paymentMethod}</td>
                  <td className="px-4 py-3 text-brown-600">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="outline" size="sm" onClick={() => setViewingId(order._id)}>
                      View
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AdminPagination pagination={pagination} onPageChange={setPage} />

      {viewingId && (
        <OrderDetailModal orderId={viewingId} onClose={() => setViewingId(null)} onUpdated={load} />
      )}
    </div>
  );
}

function OrderDetailModal({
  orderId,
  onClose,
  onUpdated,
}: {
  orderId: string;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [order, setOrder] = useState<ApiOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextStatus, setNextStatus] = useState<OrderStatus | "">("");
  const [note, setNote] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [agents, setAgents] = useState<ApiUser[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  function loadOrder() {
    setIsLoading(true);
    getOrder(orderId)
      .then(({ data }) => {
        setOrder(data.order);
        setError(null);
      })
      .catch(() => setError("Could not load order details."))
      .finally(() => setIsLoading(false));
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(loadOrder, [orderId]);

  useEffect(() => {
    listUsers({ role: "delivery_agent", limit: 100 })
      .then(({ data }) => setAgents(data.users))
      .catch(() => setAgents([]));
  }, []);

  async function handleUpdate() {
    if (!order || !nextStatus) return;
    setUpdateError(null);
    setIsUpdating(true);
    try {
      const { data } = await updateOrderStatus(order._id, nextStatus, note || undefined);
      setOrder(data.order);
      setNextStatus("");
      setNote("");
      onUpdated();
    } catch (err) {
      setUpdateError(err instanceof ApiClientError ? err.message : "Could not update order status.");
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleAssign() {
    if (!order || !selectedAgentId) return;
    setAssignError(null);
    setIsAssigning(true);
    try {
      const { data } = await assignAgent(order._id, selectedAgentId);
      setOrder(data.order);
      setSelectedAgentId("");
      onUpdated();
    } catch (err) {
      setAssignError(err instanceof ApiClientError ? err.message : "Could not assign delivery agent.");
    } finally {
      setIsAssigning(false);
    }
  }

  return (
    <Modal title={order ? `Order ${order.orderNumber}` : "Order"} onClose={onClose} wide>
      {isLoading ? (
        <TableSkeleton rows={4} />
      ) : error || !order ? (
        <ErrorState message={error ?? "Order not found."} />
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-brown-500">Placed</p>
              <p className="text-sm text-green-950">{new Date(order.createdAt).toLocaleString()}</p>
            </div>
            <StatusBadge status={order.status} />
          </div>

          <section>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-brown-500">
              Shipping Address
            </h3>
            <div className="rounded-lg border border-brown-600/10 bg-cream-50 p-4 text-sm text-green-950">
              <p className="font-medium">
                {order.shippingAddress.firstName} {order.shippingAddress.lastName}
              </p>
              <p className="text-brown-600">{order.shippingAddress.fullAddress}</p>
              <p className="text-brown-600">
                {order.shippingAddress.cityArea}, {order.shippingAddress.district}
              </p>
              <p className="text-brown-600">{order.shippingAddress.phone}</p>
              <p className="text-brown-600">{order.shippingAddress.email}</p>
              <p className="mt-2 text-xs uppercase tracking-wide text-brown-500">
                {order.deliveryMethod} delivery
              </p>
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-brown-500">Items</h3>
            <div className="overflow-hidden rounded-lg border border-brown-600/10">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-brown-600/10 bg-cream-50 text-xs uppercase tracking-wide text-brown-500">
                    <th className="px-3 py-2">Product</th>
                    <th className="px-3 py-2">Qty</th>
                    <th className="px-3 py-2">Unit</th>
                    <th className="px-3 py-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item, i) => (
                    <tr key={i} className="border-b border-brown-600/10 last:border-none">
                      <td className="px-3 py-2 text-green-950">
                        {item.productName}
                        <span className="block text-xs text-brown-500">{item.variantLabel}</span>
                      </td>
                      <td className="px-3 py-2 text-brown-600">{item.quantity}</td>
                      <td className="px-3 py-2 text-brown-600">{formatBDT(item.unitPriceBDT)}</td>
                      <td className="px-3 py-2 text-brown-600">{formatBDT(item.lineTotalBDT)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex flex-col items-end gap-1 text-sm">
              <p className="text-brown-600">Subtotal: {formatBDT(order.subtotalBDT)}</p>
              <p className="text-brown-600">Shipping: {formatBDT(order.shippingFeeBDT)}</p>
              <p className="font-semibold text-green-950">Total: {formatBDT(order.totalBDT)}</p>
              <p className="text-xs uppercase tracking-wide text-brown-500">
                {order.paymentMethod} &middot; {order.isPaid ? "Paid" : "Unpaid"}
              </p>
            </div>
          </section>

          {order.statusHistory.length > 0 && (
            <section>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-brown-500">
                Status History
              </h3>
              <ul className="flex flex-col gap-2">
                {order.statusHistory.map((entry, i) => (
                  <li key={i} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <StatusBadge status={entry.status} />
                      {entry.note && <span className="text-xs text-brown-500">{entry.note}</span>}
                    </span>
                    <span className="text-xs text-brown-500">
                      {new Date(entry.at).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {ASSIGNABLE_STATUSES.includes(order.status) && (
            <section>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-brown-500">
                Assign Delivery Agent
              </h3>
              <div className="flex flex-col gap-2">
                {assignError && <p className="text-sm text-[#8a4a3f]">{assignError}</p>}
                {agents.length === 0 ? (
                  <p className="text-sm text-brown-500">No delivery agent accounts exist yet.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <select
                      value={selectedAgentId}
                      onChange={(e) => setSelectedAgentId(e.target.value)}
                      className="h-9 rounded border border-brown-600/20 bg-white px-3 text-sm text-green-950 focus:outline-none focus:ring-1 focus:ring-green-900/30"
                    >
                      <option value="">Select an agent</option>
                      {agents.map((agent) => (
                        <option key={agent._id} value={agent._id}>
                          {agent.name}
                        </option>
                      ))}
                    </select>
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={!selectedAgentId || isAssigning}
                      onClick={handleAssign}
                    >
                      {isAssigning ? "Assigning..." : "Assign"}
                    </Button>
                  </div>
                )}
              </div>
            </section>
          )}

          <section>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-brown-500">
              Update Status
            </h3>
            {nextGenericStatuses(order.status).length === 0 ? (
              <p className="text-sm text-brown-500">
                This order is {orderStatusLabel(order.status)} and has no further status changes available here.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {updateError && <p className="text-sm text-[#8a4a3f]">{updateError}</p>}
                <div className="flex flex-wrap gap-2">
                  <select
                    value={nextStatus}
                    onChange={(e) => setNextStatus(e.target.value as OrderStatus | "")}
                    className="h-9 rounded border border-brown-600/20 bg-white px-3 text-sm text-green-950 focus:outline-none focus:ring-1 focus:ring-green-900/30"
                  >
                    <option value="">Select new status</option>
                    {nextGenericStatuses(order.status).map((s) => (
                      <option key={s} value={s}>
                        {orderStatusLabel(s)}
                      </option>
                    ))}
                  </select>
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Note (optional)"
                    className="h-9 flex-1 min-w-[160px] rounded border border-brown-600/20 bg-white px-3 text-sm text-green-950 placeholder:text-brown-500/60 focus:outline-none focus:ring-1 focus:ring-green-900/30"
                  />
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={!nextStatus || isUpdating}
                    onClick={handleUpdate}
                  >
                    {isUpdating ? "Updating..." : "Update"}
                  </Button>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </Modal>
  );
}
