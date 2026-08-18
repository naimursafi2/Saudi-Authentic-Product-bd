import { ProductModel } from "../models/Product.model";
import { InventoryLogModel, type IInventoryLog, type InventoryLogReason } from "../models/InventoryLog.model";
import { ApiError } from "../utils/ApiError";

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

/** Admin/co-admin manual stock correction — the only path that actually decides a new stock level by hand. */
export async function adjustStock(
  actorId: string,
  input: { productId: string; variantId: string; delta: number; note?: string }
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
    reason: "manual_adjustment",
    note: input.note,
    actor: actorId,
  });

  return product;
}

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
