import { ProductAlertModel, type ProductAlertType } from "../models/ProductAlert.model";
import { ProductModel, type IProduct, type IProductVariant } from "../models/Product.model";
import { ApiError } from "../utils/ApiError";
import { sendBackInStockAlertEmail, sendPriceDropAlertEmail } from "./email.service";
import { createUserNotification } from "./customerNotification.service";

function resolveVariant(product: IProduct, variantId?: string): IProductVariant {
  if (variantId) {
    const variant = product.variants.find((v) => v._id?.toString() === variantId);
    if (!variant) throw ApiError.notFound("Variant not found");
    return variant;
  }
  // No variant specified — default to the cheapest one, the same variant
  // `minPriceBDT`/the product card itself effectively represents.
  return product.variants.reduce((min, v) => (v.priceBDT < min.priceBDT ? v : min), product.variants[0]);
}

export async function subscribeToAlert(
  userId: string,
  input: { productId: string; variantId?: string; type: ProductAlertType }
) {
  const product = await ProductModel.findById(input.productId);
  if (!product) throw ApiError.notFound("Product not found");
  const variant = resolveVariant(product, input.variantId);

  if (input.type === "back_in_stock" && variant.stock > 0) {
    throw ApiError.badRequest("This item is already in stock");
  }

  const existing = await ProductAlertModel.findOne({
    user: userId,
    product: product._id,
    variantId: variant._id!.toString(),
    type: input.type,
    isActive: true,
  });
  if (existing) return existing;

  return ProductAlertModel.create({
    user: userId,
    product: product._id,
    variantId: variant._id!.toString(),
    variantLabel: variant.label,
    type: input.type,
    referencePriceBDT: input.type === "price_drop" ? variant.priceBDT : undefined,
    isActive: true,
  });
}

export async function unsubscribeFromAlert(userId: string, alertId: string): Promise<void> {
  const alert = await ProductAlertModel.findOneAndDelete({ _id: alertId, user: userId });
  if (!alert) throw ApiError.notFound("Alert not found");
}

export async function listMyAlerts(userId: string) {
  return ProductAlertModel.find({ user: userId, isActive: true })
    .populate("product", "name slug images isActive")
    .sort({ createdAt: -1 });
}

/**
 * Called once a variant's live stock is observed crossing 0 -> positive
 * (see `inventory.service.ts`/`order.service.ts`'s restock path). Never
 * throws — this runs inline with a stock write and must not fail it.
 */
export async function notifyBackInStockSubscribers(productId: string, variantId: string): Promise<void> {
  try {
    const alerts = await ProductAlertModel.find({
      product: productId,
      variantId,
      type: "back_in_stock",
      isActive: true,
    }).populate("user", "name email");
    if (alerts.length === 0) return;

    const product = await ProductModel.findById(productId).select("name slug");
    if (!product) return;

    await Promise.all(
      alerts.map(async (alert) => {
        const user = alert.user as unknown as { _id: string; name: string; email: string };
        void sendBackInStockAlertEmail(user.email, user.name, { productName: product.name, slug: product.slug });
        await createUserNotification({
          userId: user._id,
          title: "Back in stock",
          message: `${product.name} (${alert.variantLabel}) is back in stock.`,
        });
      })
    );

    await ProductAlertModel.updateMany(
      { _id: { $in: alerts.map((a) => a._id) } },
      { isActive: false, notifiedAt: new Date() }
    );
  } catch (err) {
    console.error("[productAlert] back-in-stock notify failed:", (err as Error).message);
  }
}

/**
 * Called once a variant's `priceBDT` is saved lower than it was. Never
 * throws — this runs inline with the product save and must not fail it.
 */
export async function notifyPriceDropSubscribers(
  productId: string,
  variantId: string,
  newPriceBDT: number
): Promise<void> {
  try {
    const alerts = await ProductAlertModel.find({
      product: productId,
      variantId,
      type: "price_drop",
      isActive: true,
      referencePriceBDT: { $gt: newPriceBDT },
    }).populate("user", "name email");
    if (alerts.length === 0) return;

    const product = await ProductModel.findById(productId).select("name slug");
    if (!product) return;

    await Promise.all(
      alerts.map(async (alert) => {
        const user = alert.user as unknown as { _id: string; name: string; email: string };
        void sendPriceDropAlertEmail(user.email, user.name, {
          productName: product.name,
          slug: product.slug,
          oldPriceBDT: alert.referencePriceBDT!,
          newPriceBDT,
        });
        await createUserNotification({
          userId: user._id,
          title: "Price drop",
          message: `${product.name} (${alert.variantLabel}) dropped to ৳${Math.round(newPriceBDT)}.`,
        });
      })
    );

    await ProductAlertModel.updateMany(
      { _id: { $in: alerts.map((a) => a._id) } },
      { isActive: false, notifiedAt: new Date() }
    );
  } catch (err) {
    console.error("[productAlert] price-drop notify failed:", (err as Error).message);
  }
}
