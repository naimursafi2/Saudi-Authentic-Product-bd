"use client";

import { formatBDT, formatBDTPrecise } from "@/lib/utils";
import type { ApiPurchase } from "@/types/api";

/**
 * The landed-cost maths, spelled out rather than reduced to one number:
 *
 *   Product Cost + every custom cost = Total Landed Cost
 *   Total Landed Cost / Quantity     = Actual Unit Cost
 *
 * Every figure here is derived server-side on read (Mongoose virtuals on
 * `Purchase`), so it can never disagree with the cost list beside it.
 */
export function PurchaseSummary({ purchase }: { purchase: ApiPurchase }) {
  const rows = [
    { label: "Product cost", value: formatBDT(purchase.productCostBDT) },
    {
      label: `Additional costs (${purchase.costItems.length})`,
      value: formatBDT(purchase.additionalCostBDT),
    },
  ];

  return (
    <div className="rounded border border-brown-600/10 bg-cream-50 p-4">
      <dl className="flex flex-col gap-2 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between">
            <dt className="text-brown-600">{row.label}</dt>
            <dd className="font-medium text-green-950">{row.value}</dd>
          </div>
        ))}
        <div className="flex items-center justify-between border-t border-brown-600/15 pt-2">
          <dt className="font-semibold text-green-950">Total landed cost</dt>
          <dd className="font-semibold text-green-950">{formatBDT(purchase.totalLandedCostBDT)}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-brown-600">
            Quantity
          </dt>
          <dd className="text-green-950">
            {purchase.quantity} {purchase.unit}
          </dd>
        </div>
        {purchase.status === "received" && (
          <>
            <div className="flex items-center justify-between">
              <dt className="text-brown-600">Sold</dt>
              <dd className="text-green-950">
                {purchase.soldQuantity} {purchase.unit}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-brown-600">Remaining</dt>
              <dd className="text-green-950">
                {purchase.remainingQuantity} {purchase.unit}
              </dd>
            </div>
          </>
        )}
      </dl>

      <div className="mt-3 rounded bg-brand-deep px-4 py-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-on-brand/70">
          Actual unit cost
        </p>
        <p className="font-serif text-2xl text-on-brand">{formatBDTPrecise(purchase.unitCostBDT)}</p>
        <p className="mt-0.5 text-[11px] text-on-brand/70">
          per {purchase.unit.replace(/s$/, "")} — landed cost divided by quantity
        </p>
      </div>
    </div>
  );
}
