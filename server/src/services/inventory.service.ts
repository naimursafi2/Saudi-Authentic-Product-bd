import { ProductModel } from "../models/Product.model";
import { InventoryLogModel, type IInventoryLog, type InventoryLogReason } from "../models/InventoryLog.model";
import { PurchaseModel } from "../models/Purchase.model";
import { ApiError } from "../utils/ApiError";
import { createPendingAction, registerPendingActionHandler } from "./pendingAction.service";
import { notifyBackInStockSubscribers } from "./productAlert.service";
import { notifyLowStock } from "./notification.service";
import type { Role } from "../constants/roles";

/**
 * A variant just went from 0 (or negative — shouldn't happen, but defensive)
 * to positive stock. Awaited (not fire-and-forget) at the call site — the
 * only genuinely slow part, the alert emails, is already `void`-dispatched
 * inside `notifyBackInStockSubscribers` itself, so awaiting the DB-only
 * orchestration around it costs nothing and means a caller can trust the
 * alert has already been resolved by the time this request responds.
 */
async function maybeNotifyBackInStock(
  productId: string,
  variantId: string,
  previousStock: number,
  newStock: number
): Promise<void> {
  if (previousStock <= 0 && newStock > 0) {
    await notifyBackInStockSubscribers(productId, variantId);
  }
}

export interface StockActor {
  id: string;
  role: Role;
}

/** One variant's intended absolute stock level, as submitted by a staff member. */
export interface DesiredVariantStock {
  variantId: string;
  label: string;
  stock: number;
}

export type StockChangeResult = { kind: "applied" } | { kind: "pending"; pendingActionId: string };

export interface RecordStockChangeInput {
  productId: string;
  variantId: string;
  variantLabel: string;
  delta: number;
  balanceAfter: number;
  reason: InventoryLogReason;
  note?: string;
  actor?: string;
  purchaseBatch?: string;
  unitCostBDT?: number;
}

/** Low-level audit-log write, called after the stock number itself has already changed. */
export async function recordStockChange(input: RecordStockChangeInput): Promise<IInventoryLog> {
  return InventoryLogModel.create({
    product: input.productId,
    variantId: input.variantId,
    variantLabel: input.variantLabel,
    delta: input.delta,
    balanceAfter: input.balanceAfter,
    reason: input.reason,
    note: input.note,
    actor: input.actor,
    purchaseBatch: input.purchaseBatch,
    unitCostBDT: input.unitCostBDT,
  });
}

// -- Landed-cost sale consumption ---------------------------------------
//
// A sale's actual profit depends on what the specific units sold actually
// cost to land, which can differ batch to batch (see CLAUDE.md's
// "Purchasing: shops, batches & flexible landed costs"). This is the one
// place a sale's stock decrement is resolved against real Purchase-batch
// history — `order.service.ts#createOrder` calls it instead of writing the
// `$inc`/`InventoryLog` pair itself, the same centralization
// `applyStockDelta` already gives every other kind of stock write.

export interface BatchConsumption {
  purchase: string;
  quantity: number;
  unitCostBDT: number;
}

export interface SaleConsumptionResult {
  /** Quantity-weighted across whichever batch(es) were drawn from — frozen onto the order item, never recomputed later. */
  unitLandedCostBDT: number;
  /** False only when no purchase-batch history existed at all for this variant, so `unitLandedCostBDT` is 0 rather than a real figure. */
  costBasisKnown: boolean;
  /** Which batches (and how much of each) this sale actually drew from — carried onto the order item so a later cancellation/return can credit the exact same batches back (see `restockFromSale`). */
  consumptions: BatchConsumption[];
}

/**
 * The weighted-average landed unit cost across every batch ever *received*
 * for a variant (not just those with quantity still remaining) — the same
 * figure `purchase.service.ts#getProductCostHistory` reports as
 * `averageUnitCostBDT`. Used as the fallback cost basis for a sale that
 * outruns its batches' remaining quantity: pre-existing stock recorded
 * before this system existed, or stock added by a manual adjustment, still
 * gets a reasonable costing instead of blocking the sale or silently costing
 * at zero.
 */
async function getAverageUnitCostBDT(productId: string, variantId: string): Promise<number> {
  const batches = await PurchaseModel.find({ product: productId, variantId, status: "received" });
  if (batches.length === 0) return 0;
  const totalQuantity = batches.reduce((sum, b) => sum + b.quantity, 0);
  if (totalQuantity <= 0) return 0;
  const totalLandedCostBDT = batches.reduce((sum, b) => sum + b.totalLandedCostBDT, 0);
  return totalLandedCostBDT / totalQuantity;
}

/**
 * Draws `quantity` units of one order line's cost basis from the variant's
 * received Purchase batches, oldest-received-first (FIFO), decrementing each
 * batch's `remainingQuantity` with a guarded atomic update (mirroring
 * `coupon.service.ts#applyCouponUsage`'s `$lt`/`$gte` guard pattern) so two
 * concurrent sales can never draw the same unit from a batch twice even
 * without a multi-document transaction — a batch that loses that race is
 * simply skipped and its shortfall is absorbed by the next batch or the
 * average-cost fallback below, not by throwing.
 *
 * Also performs the actual `Product.variants[].stock` decrement (one `$inc`
 * per batch portion, so `InventoryLog.balanceAfter` stays a true step-wise
 * running total) and the low-stock-crossing check, replacing what
 * `order.service.ts#createOrder` used to do directly — this keeps stock
 * writes and their audit trail in one place regardless of how many batches
 * one line item's quantity happens to span.
 */
export async function consumeStockForSale(input: {
  productId: string;
  variantId: string;
  variantLabel: string;
  quantity: number;
  orderNumber: string;
}): Promise<SaleConsumptionResult> {
  const before = await ProductModel.findById(input.productId).select("name variants");
  const variantBefore = before?.variants.find((v) => v._id?.toString() === input.variantId);
  const previousStock = variantBefore?.stock ?? 0;
  const threshold = variantBefore?.lowStockThreshold ?? 0;
  const productName = before?.name ?? "";

  const consumptions: BatchConsumption[] = [];
  let remaining = input.quantity;
  let costSum = 0;
  let latestStock = previousStock;

  async function decrementLiveStock(take: number): Promise<void> {
    const updated = await ProductModel.findOneAndUpdate(
      { _id: input.productId, "variants._id": input.variantId },
      { $inc: { "variants.$.stock": -take } },
      { returnDocument: "after" }
    );
    const variant = updated?.variants.find((v) => v._id?.toString() === input.variantId);
    latestStock = variant?.stock ?? latestStock - take;
  }

  const batches = await PurchaseModel.find({
    product: input.productId,
    variantId: input.variantId,
    status: "received",
    remainingQuantity: { $gt: 0 },
  }).sort({ receivedAt: 1, createdAt: 1 });

  for (const batch of batches) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, batch.remainingQuantity);
    if (take <= 0) continue;

    const decremented = await PurchaseModel.updateOne(
      { _id: batch._id, remainingQuantity: { $gte: take } },
      { $inc: { remainingQuantity: -take } }
    );
    if (decremented.modifiedCount === 0) continue;

    await decrementLiveStock(take);
    await recordStockChange({
      productId: input.productId,
      variantId: input.variantId,
      variantLabel: input.variantLabel,
      delta: -take,
      balanceAfter: latestStock,
      reason: "order_placed",
      note: `Order ${input.orderNumber} (batch ${batch.reference})`,
      purchaseBatch: batch._id.toString(),
      unitCostBDT: batch.unitCostBDT,
    });

    consumptions.push({ purchase: batch._id.toString(), quantity: take, unitCostBDT: batch.unitCostBDT });
    costSum += take * batch.unitCostBDT;
    remaining -= take;
  }

  let costBasisKnown = consumptions.length > 0;

  if (remaining > 0) {
    const fallbackUnitCost = await getAverageUnitCostBDT(input.productId, input.variantId);
    await decrementLiveStock(remaining);
    await recordStockChange({
      productId: input.productId,
      variantId: input.variantId,
      variantLabel: input.variantLabel,
      delta: -remaining,
      balanceAfter: latestStock,
      reason: "order_placed",
      note: `Order ${input.orderNumber} (${
        fallbackUnitCost > 0 ? "no batch remaining — average of prior batches" : "no purchase-batch history"
      })`,
      unitCostBDT: fallbackUnitCost > 0 ? fallbackUnitCost : undefined,
    });

    costSum += remaining * fallbackUnitCost;
    if (fallbackUnitCost > 0) costBasisKnown = true;
  }

  if (previousStock > threshold && latestStock <= threshold) {
    void notifyLowStock({ productName, variantLabel: input.variantLabel, stock: latestStock, threshold });
  }

  return {
    unitLandedCostBDT: input.quantity > 0 ? costSum / input.quantity : 0,
    costBasisKnown,
    consumptions,
  };
}

/**
 * The reverse of `consumeStockForSale` — an order being cancelled/returned
 * credits its stock, and its exact source batches, back. `Product.variants[]
 * .stock` is restored in one `$inc` (the whole item quantity is always
 * genuinely back in stock together, regardless of how many batches it was
 * originally drawn from); each batch's `remainingQuantity` is credited back
 * individually so a later sale's FIFO draw sees the same batches available
 * again, oldest-first, exactly as if the sale had never happened. The
 * portion that had no batch to draw from originally (an "unknown cost"
 * consumption) has nothing to credit back — it was never subtracted from any
 * batch's `remainingQuantity` in the first place.
 */
export async function restockFromSale(
  item: { product: string; variantId: string; variantLabel: string; quantity: number; batchConsumptions: BatchConsumption[] },
  reason: Extract<InventoryLogReason, "order_cancelled" | "order_returned">,
  orderNumber: string
): Promise<void> {
  const before = await ProductModel.findOne(
    { _id: item.product, "variants._id": item.variantId },
    { "variants.$": 1 }
  );
  const previousStock = before?.variants[0]?.stock ?? 0;

  const updated = await ProductModel.findOneAndUpdate(
    { _id: item.product, "variants._id": item.variantId },
    { $inc: { "variants.$.stock": item.quantity } },
    { returnDocument: "after" }
  );
  const variant = updated?.variants.find((v) => v._id?.toString() === item.variantId);
  const newStock = variant?.stock ?? 0;

  const actionLabel = reason === "order_cancelled" ? "cancelled" : "returned";

  if (item.batchConsumptions.length > 0) {
    for (const consumption of item.batchConsumptions) {
      await PurchaseModel.updateOne(
        { _id: consumption.purchase },
        { $inc: { remainingQuantity: consumption.quantity } }
      );
      await recordStockChange({
        productId: item.product,
        variantId: item.variantId,
        variantLabel: item.variantLabel,
        delta: consumption.quantity,
        balanceAfter: newStock,
        reason,
        note: `Order ${orderNumber} ${actionLabel}`,
        purchaseBatch: consumption.purchase,
        unitCostBDT: consumption.unitCostBDT,
      });
    }
  } else {
    await recordStockChange({
      productId: item.product,
      variantId: item.variantId,
      variantLabel: item.variantLabel,
      delta: item.quantity,
      balanceAfter: newStock,
      reason,
      note: `Order ${orderNumber} ${actionLabel}`,
    });
  }

  if (previousStock <= 0 && newStock > 0) {
    await notifyBackInStockSubscribers(item.product, item.variantId);
  }
}

/**
 * Stock value at its actual landed cost, not a guessed/list price —
 * `remainingQuantity × unitCostBDT` summed across every received batch, per
 * variant and in total. A variant's live stock can exceed the sum of its
 * batches' remaining quantity (pre-existing stock from before this system
 * existed, or a manual adjustment) — that portion is valued at the same
 * average-cost fallback `consumeStockForSale` uses, so the reported total
 * still reconciles against `Product.variants[].stock` rather than silently
 * under-counting.
 */
export async function getInventoryValuation() {
  const products = await ProductModel.find({ isActive: true }).select("name slug variants");

  const rows = await Promise.all(
    products.flatMap((product) =>
      product.variants.map(async (variant) => {
        const variantId = variant._id!.toString();
        const batches = await PurchaseModel.find({
          product: product._id,
          variantId,
          status: "received",
        });

        const batchRemainingTotal = batches.reduce((sum, b) => sum + b.remainingQuantity, 0);
        const batchValueBDT = batches.reduce((sum, b) => sum + b.remainingQuantity * b.unitCostBDT, 0);

        const unallocatedQuantity = Math.max(0, variant.stock - batchRemainingTotal);
        const averageUnitCostBDT =
          batches.length > 0
            ? batches.reduce((sum, b) => sum + b.totalLandedCostBDT, 0) /
              Math.max(1, batches.reduce((sum, b) => sum + b.quantity, 0))
            : 0;
        const unallocatedValueBDT = unallocatedQuantity * averageUnitCostBDT;

        return {
          productId: product._id.toString(),
          productName: product.name,
          productSlug: product.slug,
          variantId,
          variantLabel: variant.label,
          stock: variant.stock,
          batchTrackedQuantity: batchRemainingTotal,
          unallocatedQuantity,
          averageUnitCostBDT,
          inventoryValueBDT: batchValueBDT + unallocatedValueBDT,
        };
      })
    )
  );

  const filtered = rows.filter((row) => row.stock > 0);
  return {
    variants: filtered,
    totalInventoryValueBDT: filtered.reduce((sum, row) => sum + row.inventoryValueBDT, 0),
  };
}

/**
 * Applies a signed stock delta and writes the inventory-history entry. The
 * delta is re-evaluated against whatever the stock is *now*, so a request
 * that sits in the approval queue while sales come in still lands correctly.
 */
async function applyStockDelta(
  actorId: string,
  input: {
    productId: string;
    variantId: string;
    delta: number;
    note?: string;
    reason?: InventoryLogReason;
  }
) {
  const product = await ProductModel.findById(input.productId);
  if (!product) throw ApiError.notFound("Product not found");

  const variant = product.variants.find((v) => v._id?.toString() === input.variantId);
  if (!variant) throw ApiError.notFound("Variant not found");

  const newStock = variant.stock + input.delta;
  if (newStock < 0) throw ApiError.badRequest("Adjustment would result in negative stock");

  const previousStock = variant.stock;
  variant.stock = newStock;
  await product.save();

  await recordStockChange({
    productId: product._id.toString(),
    variantId: input.variantId,
    variantLabel: variant.label,
    delta: input.delta,
    balanceAfter: newStock,
    reason: input.reason ?? "manual_adjustment",
    note: input.note,
    actor: actorId,
  });

  await maybeNotifyBackInStock(product._id.toString(), input.variantId, previousStock, newStock);

  return product;
}

/**
 * Stock arriving from a received purchase batch. Separate from
 * `adjustStock` only so the movement is logged as `purchase_received`
 * rather than a manual correction — the gating decision itself lives in
 * `purchase.service.ts`, which also has to flip the purchase's own status.
 */
export async function applyPurchaseStock(
  actorId: string,
  input: { productId: string; variantId: string; quantity: number; note?: string }
) {
  return applyStockDelta(actorId, {
    productId: input.productId,
    variantId: input.variantId,
    delta: input.quantity,
    note: input.note,
    reason: "purchase_received",
  });
}

/**
 * Manual stock correction. **Only `super_admin` changes stock directly** —
 * every other role's adjustment is parked in the approval queue and the live
 * stock count is left untouched until a Super Admin grants it (see
 * "Stock-change approval gate" in CLAUDE.md). Approval gates *when* the change
 * goes live; it does not replace the `InventoryLog` history, which is still
 * written at the moment the change actually applies.
 */
export async function adjustStock(
  actor: StockActor,
  input: { productId: string; variantId: string; delta: number; note?: string }
): Promise<StockChangeResult> {
  if (actor.role === "super_admin") {
    await applyStockDelta(actor.id, input);
    return { kind: "applied" };
  }

  const product = await ProductModel.findById(input.productId);
  if (!product) throw ApiError.notFound("Product not found");
  const variant = product.variants.find((v) => v._id?.toString() === input.variantId);
  if (!variant) throw ApiError.notFound("Variant not found");
  if (variant.stock + input.delta < 0) {
    throw ApiError.badRequest("Adjustment would result in negative stock");
  }

  const action = await createPendingAction(
    "inventory.adjust",
    {
      productId: input.productId,
      productName: product.name,
      variantId: input.variantId,
      variantLabel: variant.label,
      delta: input.delta,
      note: input.note,
    },
    actor,
    input.note
  );
  return { kind: "pending", pendingActionId: action._id.toString() };
}

/** Sets one variant to an absolute stock value, logging the implied delta. */
async function setVariantStock(
  actorId: string,
  target: { productId: string; variantId: string; label: string; stock: number },
  note?: string
): Promise<void> {
  const product = await ProductModel.findById(target.productId);
  if (!product) return;

  // The variant is addressed by id, but a later wholesale variant replacement
  // can regenerate ids, so fall back to matching on the label it had when the
  // request was made.
  const variant =
    product.variants.find((v) => v._id?.toString() === target.variantId) ??
    product.variants.find((v) => v.label === target.label);
  if (!variant) return;

  const delta = target.stock - variant.stock;
  if (delta === 0) return;

  const previousStock = variant.stock;
  variant.stock = target.stock;
  await product.save();

  await recordStockChange({
    productId: product._id.toString(),
    variantId: variant._id!.toString(),
    variantLabel: variant.label,
    delta,
    balanceAfter: target.stock,
    reason: "manual_adjustment",
    note: note ?? "Stock update",
    actor: actorId,
  });

  await maybeNotifyBackInStock(product._id.toString(), variant._id!.toString(), previousStock, target.stock);
}

/**
 * The stock half of a product create/update. `super_admin` writes the values
 * straight through; anyone else gets them queued for approval while the live
 * stock stays as it was (a brand-new product starts at 0 until granted).
 * Returns `null` when nothing about stock actually changed, so a plain
 * title/description edit never creates an empty approval request.
 */
export async function requestVariantStockUpdate(
  actor: StockActor,
  target: { productId: string; productName: string; stocks: DesiredVariantStock[] },
  note?: string
): Promise<StockChangeResult | null> {
  if (target.stocks.length === 0) return null;

  if (actor.role === "super_admin") {
    for (const stock of target.stocks) {
      await setVariantStock(actor.id, { productId: target.productId, ...stock }, note);
    }
    return { kind: "applied" };
  }

  const action = await createPendingAction(
    "product.stock.update",
    { productId: target.productId, productName: target.productName, stocks: target.stocks },
    actor,
    note
  );
  return { kind: "pending", pendingActionId: action._id.toString() };
}

// -- Approval-gate handlers (see pendingAction.service.ts for why these are
// registered here rather than imported by that module). --
registerPendingActionHandler("inventory.adjust", async (payload, reviewer) => {
  const product = await applyStockDelta(reviewer.id, {
    productId: payload.productId as string,
    variantId: payload.variantId as string,
    delta: payload.delta as number,
    note: (payload.note as string | undefined) ?? "Applied via approval grant",
  });
  return { resource: "Product", resourceId: product._id.toString() };
});

registerPendingActionHandler("product.stock.update", async (payload, reviewer) => {
  const productId = payload.productId as string;
  for (const stock of payload.stocks as DesiredVariantStock[]) {
    await setVariantStock(reviewer.id, { productId, ...stock }, "Applied via approval grant");
  }
  return { resource: "Product", resourceId: productId };
});

export async function listInventoryLogs(filter: { product?: string; page: number; limit: number }) {
  const query: Record<string, unknown> = {};
  if (filter.product) query.product = filter.product;

  const skip = (filter.page - 1) * filter.limit;
  const [logs, total] = await Promise.all([
    InventoryLogModel.find(query)
      .populate("product", "name slug")
      .populate("actor", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(filter.limit),
    InventoryLogModel.countDocuments(query),
  ]);

  return {
    logs,
    pagination: {
      page: filter.page,
      limit: filter.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / filter.limit)),
    },
  };
}

/**
 * Live per-variant stock for the whole catalogue, read straight from
 * `Product.variants` — the same single source of truth the storefront and
 * admin portal render, so there is no second stock number to drift out of
 * sync. Powers the Employee portal's read-only stock view.
 */
export async function listStockLevels(search?: string) {
  const filter: Record<string, unknown> = {};
  if (search) filter.name = { $regex: search, $options: "i" };

  const products = await ProductModel.find(filter)
    .select("name slug images variants isActive")
    .sort({ name: 1 });

  return products.map((product) => ({
    _id: product._id.toString(),
    name: product.name,
    slug: product.slug,
    isActive: product.isActive,
    image: product.images[0]?.url,
    totalStock: product.variants.reduce((sum, v) => sum + v.stock, 0),
    variants: product.variants.map((v) => ({
      variantId: v._id!.toString(),
      label: v.label,
      stock: v.stock,
      lowStockThreshold: v.lowStockThreshold,
    })),
  }));
}

/** Products with at least one variant at or below its low-stock threshold. */
export async function listLowStockProducts() {
  const products = await ProductModel.find({ isActive: true }).select(
    "name slug variants images"
  );
  return products
    .map((product) => ({
      product,
      lowStockVariants: product.variants.filter((v) => v.stock <= v.lowStockThreshold),
    }))
    .filter((entry) => entry.lowStockVariants.length > 0);
}

export async function countLowStockProducts(): Promise<number> {
  const lowStock = await listLowStockProducts();
  return lowStock.length;
}

/**
 * Products with at least one variant at exactly zero — a stricter, distinct
 * signal from "low stock" (`stock <= lowStockThreshold`, which a variant
 * with `lowStockThreshold: 0` would never even cross). Out-of-stock
 * products are always a subset of low-stock ones.
 */
export async function listOutOfStockProducts() {
  const products = await ProductModel.find({ isActive: true }).select("name slug variants images");
  return products
    .map((product) => ({
      product,
      outOfStockVariants: product.variants.filter((v) => v.stock === 0),
    }))
    .filter((entry) => entry.outOfStockVariants.length > 0);
}

export async function countOutOfStockProducts(): Promise<number> {
  const outOfStock = await listOutOfStockProducts();
  return outOfStock.length;
}
