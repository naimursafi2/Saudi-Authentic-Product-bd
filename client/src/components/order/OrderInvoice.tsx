"use client";

import { useState } from "react";
import Image from "next/image";
import { Printer } from "lucide-react";
import { getSiteSettings } from "@/lib/api/siteSettings";
import { getPaymentForOrder } from "@/lib/api/payments";
import { downloadInvoicePdf } from "@/lib/pdfExport";
import { formatBDT } from "@/lib/utils";
import { Modal } from "@/components/admin/Modal";
import { Button } from "@/components/ui/Button";
import type { ApiOrder, ApiPayment, ApiSiteSettings } from "@/types/api";

function customerName(customer: ApiOrder["customer"]): string {
  return typeof customer === "string" ? customer : customer.name;
}

const PAYMENT_METHOD_LABELS: Record<ApiOrder["paymentMethod"], string> = {
  cod: "Cash on Delivery",
  bkash: "bKash",
  nagad: "Nagad",
};

/**
 * The on-screen preview of the invoice. It renders from the same `order`,
 * `settings` and `payment` that `handleDownload` writes into the PDF, so what
 * the user sees here is what the downloaded file contains.
 */
function InvoiceDocument({
  order,
  settings,
  payment,
}: {
  order: ApiOrder;
  settings: ApiSiteSettings | null;
  payment: ApiPayment | null;
}) {
  return (
    <div className="bg-white p-8 text-[#1b1b1b]">
      <div className="mb-8 flex items-start justify-between gap-6 border-b border-gray-300 pb-6">
        <div className="flex items-center gap-3">
          {settings?.logo?.url && (
            <span className="relative block h-12 w-32">
              <Image src={settings.logo.url} alt={settings.siteName} fill className="object-contain object-left" />
            </span>
          )}
          {!settings?.logo?.url && (
            <span className="text-lg font-bold">{settings?.siteName ?? "Saudi Authentic Product"}</span>
          )}
        </div>
        <div className="text-right">
          <h1 className="text-2xl font-bold uppercase tracking-wide">Invoice</h1>
          <p className="mt-1 text-sm text-gray-600">Order #{order.orderNumber}</p>
          <p className="text-sm text-gray-600">
            {new Date(order.createdAt).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-6">
        <div>
          <h2 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-gray-500">Billed To</h2>
          <p className="font-semibold">
            {order.shippingAddress.firstName} {order.shippingAddress.lastName}
          </p>
          <p className="text-sm text-gray-700">{customerName(order.customer)}</p>
          <p className="text-sm text-gray-700">{order.shippingAddress.email}</p>
          <p className="text-sm text-gray-700">{order.shippingAddress.phone}</p>
          <p className="text-sm text-gray-700">
            {order.shippingAddress.fullAddress}, {order.shippingAddress.cityArea}, {order.shippingAddress.district}
          </p>
        </div>
        <div className="text-right">
          <h2 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-gray-500">Payment</h2>
          <p className="text-sm text-gray-700">
            Method:{" "}
            <span className="font-medium">{PAYMENT_METHOD_LABELS[order.paymentMethod]}</span>
          </p>
          <p className="text-sm text-gray-700">
            Status:{" "}
            <span className={`font-medium ${order.isPaid ? "text-green-700" : "text-amber-700"}`}>
              {order.isPaid ? "Paid" : "Unpaid"}
            </span>
          </p>
          {payment?.transactionId && (
            <p className="text-sm text-gray-700">
              Reference: <span className="font-medium">{payment.transactionId}</span>
            </p>
          )}
          {payment?.paidAt && (
            <p className="text-sm text-gray-700">
              Paid on{" "}
              {new Date(payment.paidAt).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          )}
          {settings?.contactPhone && <p className="mt-2 text-sm text-gray-700">{settings.contactPhone}</p>}
          {settings?.contactEmail && <p className="text-sm text-gray-700">{settings.contactEmail}</p>}
        </div>
      </div>

      <table className="mb-8 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-gray-800 text-left text-xs uppercase tracking-wide text-gray-600">
            <th className="py-2">Product</th>
            <th className="py-2 text-right">Unit Price</th>
            <th className="py-2 text-right">Qty</th>
            <th className="py-2 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item, i) => (
            <tr key={i} className="border-b border-gray-200">
              <td className="py-2.5">
                {item.productName}
                <span className="block text-xs text-gray-500">{item.variantLabel}</span>
              </td>
              <td className="py-2.5 text-right">{formatBDT(item.unitPriceBDT)}</td>
              <td className="py-2.5 text-right">{item.quantity}</td>
              <td className="py-2.5 text-right">{formatBDT(item.lineTotalBDT)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex justify-end">
        <div className="w-full max-w-xs text-sm">
          <div className="flex justify-between py-1">
            <span className="text-gray-600">Subtotal</span>
            <span>{formatBDT(order.subtotalBDT)}</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-gray-600">Shipping</span>
            <span>{formatBDT(order.shippingFeeBDT)}</span>
          </div>
          {order.discountBDT > 0 && (
            <div className="flex justify-between py-1">
              <span className="text-gray-600">Discount{order.couponCode ? ` (${order.couponCode})` : ""}</span>
              <span>-{formatBDT(order.discountBDT)}</span>
            </div>
          )}
          <div className="mt-1 flex justify-between border-t-2 border-gray-800 py-2 text-base font-bold">
            <span>Total</span>
            <span>{formatBDT(order.totalBDT)}</span>
          </div>
        </div>
      </div>

      <p className="mt-10 text-center text-xs text-gray-500">
        Thank you for shopping with {settings?.siteName ?? "Saudi Authentic Product"}.
      </p>
    </div>
  );
}

/**
 * Generates the invoice PDF from exactly the data `InvoiceDocument` above
 * renders, so the downloaded file and the on-screen preview can never disagree
 * — including the optional rows (a discount line, a gateway reference) that
 * only some orders have. Dated by the ORDER, not by the day it is downloaded:
 * an invoice is a fixed historical record, so re-downloading it next month
 * must produce the same file under the same name.
 */
function handleDownload(order: ApiOrder, settings: ApiSiteSettings | null, payment: ApiPayment | null) {
  const siteName = settings?.siteName ?? "Saudi Authentic Product";
  const orderDate = new Date(order.createdAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  downloadInvoicePdf({
    filenamePrefix: `Invoice-${order.orderNumber}`,
    dateContext: order.createdAt,
    siteName,
    orderNumber: order.orderNumber,
    orderDate,
    billedTo: [
      `${order.shippingAddress.firstName} ${order.shippingAddress.lastName}`,
      customerName(order.customer),
      order.shippingAddress.email,
      order.shippingAddress.phone,
      `${order.shippingAddress.fullAddress}, ${order.shippingAddress.cityArea}, ${order.shippingAddress.district}`,
    ],
    payment: [
      `Method: ${PAYMENT_METHOD_LABELS[order.paymentMethod]}`,
      `Status: ${order.isPaid ? "Paid" : "Unpaid"}`,
      ...(payment?.transactionId ? [`Reference: ${payment.transactionId}`] : []),
      ...(payment?.paidAt
        ? [
            `Paid on ${new Date(payment.paidAt).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}`,
          ]
        : []),
      ...(settings?.contactPhone ? [settings.contactPhone] : []),
      ...(settings?.contactEmail ? [settings.contactEmail] : []),
    ],
    columns: [
      { header: "Product", width: 0.46 },
      { header: "Unit Price", align: "right", width: 0.2 },
      { header: "Qty", align: "right", width: 0.12 },
      { header: "Total", align: "right", width: 0.22 },
    ],
    rows: order.items.map((item) => [
      `${item.productName} (${item.variantLabel})`,
      formatBDT(item.unitPriceBDT),
      item.quantity,
      formatBDT(item.lineTotalBDT),
    ]),
    totals: [
      { label: "Subtotal", value: formatBDT(order.subtotalBDT) },
      { label: "Shipping", value: formatBDT(order.shippingFeeBDT) },
      ...(order.discountBDT > 0
        ? [
            {
              label: `Discount${order.couponCode ? ` (${order.couponCode})` : ""}`,
              value: `-${formatBDT(order.discountBDT)}`,
            },
          ]
        : []),
      { label: "Total", value: formatBDT(order.totalBDT), strong: true },
    ],
    closingNote: `Thank you for shopping with ${siteName}.`,
    footer: siteName,
  });
}

/** Drop this next to any order's actions — customer order history, the admin
 * order-detail modal, etc. — to offer a professional printable invoice. */
export function PrintInvoiceButton({ order }: { order: ApiOrder }) {
  const [isOpen, setIsOpen] = useState(false);
  const [settings, setSettings] = useState<ApiSiteSettings | null>(null);
  const [payment, setPayment] = useState<ApiPayment | null>(null);

  function handleOpen() {
    setIsOpen(true);
    if (!settings) {
      getSiteSettings()
        .then(({ data }) => setSettings(data.settings))
        .catch(() => {});
    }
    // Only gateway-settled orders have a payment record; a missing one (or a
    // viewer without permission to read it) simply leaves the reference row
    // off the invoice rather than blocking it.
    if (!payment) {
      getPaymentForOrder(order._id)
        .then(({ data }) => setPayment(data.payment))
        .catch(() => {});
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.06em] text-green-900 hover:text-green-950"
      >
        <Printer size={12} /> Print Invoice
      </button>

      {isOpen && (
        <Modal title={`Invoice — #${order.orderNumber}`} onClose={() => setIsOpen(false)} wide>
          <div className="flex flex-col gap-4">
            <div className="flex justify-end">
              <Button variant="primary" size="sm" onClick={() => handleDownload(order, settings, payment)}>
                <Printer size={14} /> Print
              </Button>
            </div>
            <div className="overflow-hidden rounded-lg border border-gray-200">
              <InvoiceDocument order={order} settings={settings} payment={payment} />
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
