import { ProductModel } from "../models/Product.model";
import { InventoryLogModel, type IInventoryLog, type InventoryLogReason } from "../models/InventoryLog.model";
import { ApiError } from "../utils/ApiError";
import { createPendingAction, registerPendingActionHandler } from "./pendingAction.service";
import type { Role } from "../constants/roles";

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
  });
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
