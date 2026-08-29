import { QueryFilter, Types } from "mongoose";
import { ProductModel, type IProduct } from "../models/Product.model";
import { CategoryModel } from "../models/Category.model";
import { ReviewModel } from "../models/Review.model";
import { ApiError } from "../utils/ApiError";
import {
  purgeAssetsByPublicId,
  retireInternalAsset,
  uploadInternalFile,
  type AssetActor,
} from "./internalAsset.service";
import { slugify } from "../utils/slugify";
import {
  createPendingAction,
  registerPendingActionHandler,
  registerPendingActionDenyHandler,
} from "./pendingAction.service";
import { recordAuditLog } from "./auditLog.service";
import { requestVariantStockUpdate, type DesiredVariantStock, type StockActor } from "./inventory.service";
import { notifyPriceDropSubscribers } from "./productAlert.service";
import type {
  CreateProductInput,
  ListProductsQuery,
  UpdateProductInput,
} from "../validators/product.validator";
import type { Role } from "../constants/roles";

const SORT_MAP: Record<ListProductsQuery["sort"], Record<string, 1 | -1>> = {
  featured: { isFeatured: -1, createdAt: -1 },
  "price-asc": { minPriceBDT: 1 },
  "price-desc": { minPriceBDT: -1 },
  rating: { ratingAverage: -1 },
  newest: { createdAt: -1 },
};

export async function listProducts(query: ListProductsQuery) {
  const filter: QueryFilter<IProduct> = { isActive: true };

  if (query.ids && query.ids.length > 0) {
    filter._id = { $in: query.ids };
  }

  if (query.q) {
    filter.$text = { $search: query.q };
  }

  if (query.category) {
    const category = await CategoryModel.findOne({ slug: query.category });
    if (!category) {
      return {
        products: [],
        pagination: { page: query.page, limit: query.limit, total: 0, totalPages: 1 },
      };
    }
    filter.categories = category._id;
  }

  if (query.minPrice != null || query.maxPrice != null) {
    filter.minPriceBDT = {};
    if (query.minPrice != null) filter.minPriceBDT.$gte = query.minPrice;
    if (query.maxPrice != null) filter.minPriceBDT.$lte = query.maxPrice;
  }

  if (query.minRating != null) {
    filter.ratingAverage = { $gte: query.minRating };
  }

  if (query.isBestSeller != null) {
    filter.isBestSeller = query.isBestSeller;
  }

  if (query.isFeatured != null) {
    filter.isFeatured = query.isFeatured;
  }

  const skip = (query.page - 1) * query.limit;
  const [products, total] = await Promise.all([
    ProductModel.find(filter)
      .populate("categories", "name slug")
      .sort(SORT_MAP[query.sort])
      .skip(skip)
      .limit(query.limit),
    ProductModel.countDocuments(filter),
  ]);

  return {
    products,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    },
  };
}

export async function getProductBySlug(slug: string) {
  const product = await ProductModel.findOne({ slug, isActive: true }).populate(
    "categories",
    "name slug"
  );
  if (!product) throw ApiError.notFound("Product not found");
  return product;
}

export async function getProductById(id: string) {
  const product = await ProductModel.findById(id).populate("categories", "name slug");
  if (!product) throw ApiError.notFound("Product not found");
  return product;
}

export async function getRelatedProducts(product: IProduct, limit = 5) {
  return ProductModel.find({
    _id: { $ne: product._id },
    categories: { $in: product.categories },
    isActive: true,
  })
    .populate("categories", "name slug")
    .limit(limit);
}

/**
 * Content fields that any Admin/Co-Admin may edit directly. Per the spec,
 * these are **not** approval-gated — but every change is recorded in the
 * audit log with the old and new value, so a Super Admin can see who changed
 * what and when at `/admin/audit-logs`. Stock is deliberately absent: it goes
 * through the approval gate instead (see `requestVariantStockUpdate`).
 */
const AUDITED_PRODUCT_FIELDS = [
  "name",
  "slug",
  "tagline",
  "description",
  "origin",
  "badge",
  "storageInstructions",
  "isBestSeller",
  "isFeatured",
] as const;

type AuditedProductField = (typeof AUDITED_PRODUCT_FIELDS)[number];

function diffProductFields(before: IProduct, input: UpdateProductInput) {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const field of AUDITED_PRODUCT_FIELDS) {
    const next = (input as Record<string, unknown>)[field];
    if (next === undefined) continue;
    const previous = (before as unknown as Record<string, unknown>)[field];
    if (previous !== next) changes[field] = { from: previous, to: next };
  }
  return changes;
}

export type CreateProductResult =
  | { kind: "created"; product: IProduct }
  | { kind: "pending"; pendingActionId: string };

/**
 * A new product from anyone but `super_admin` never touches the live
 * catalog. The whole submission — content, images and stock together — is
 * queued as a `product.create` pending action and the `Product` document is
 * only actually created once a Super Admin grants it, per the
 * product-approval requirement (co_admin **and** admin are both gated —
 * `super_admin` is the only role that publishes directly, same convention
 * as the stock-change gate). Images are uploaded to Cloudinary up front so
 * validation and the Super Admin's review both see the real photos; if the
 * request is later denied they're cleaned up (see the deny handler below).
 */
export async function createProduct(
  input: CreateProductInput,
  actor: StockActor,
  images?: Express.Multer.File[]
): Promise<CreateProductResult> {
  const slug = input.slug ?? slugify(input.name);
  const existing = await ProductModel.findOne({ slug });
  if (existing) throw ApiError.conflict("A product with this slug already exists");

  const categories = await CategoryModel.find({ _id: { $in: input.categories } });
  if (categories.length !== input.categories.length) {
    throw ApiError.badRequest("One or more categories are invalid");
  }

  const uploadedImages = images && images.length > 0 ? await uploadProductImages(images, actor) : [];

  if (actor.role !== "super_admin") {
    const action = await createPendingAction(
      "product.create",
      { ...input, slug, images: uploadedImages },
      actor,
      `New product "${input.name}" submitted for approval`
    );
    return { kind: "pending", pendingActionId: action._id.toString() };
  }

  const product = new ProductModel({ ...input, slug, images: uploadedImages });
  await product.save();

  await recordAuditLog({
    actor: actor.id,
    actorRole: actor.role,
    action: "product.create",
    resource: "Product",
    resourceId: product._id.toString(),
    newValue: { name: product.name, slug: product.slug },
  });

  return { kind: "created", product };
}

/** The shape a `product.create` pending action's payload always carries. */
type ProductCreatePayload = Omit<CreateProductInput, "existingImages"> & {
  images: { url: string; publicId: string; isPrimary?: boolean }[];
};

registerPendingActionHandler("product.create", async (payload, reviewer) => {
  const data = payload as unknown as ProductCreatePayload;

  const existing = await ProductModel.findOne({ slug: data.slug });
  if (existing) {
    throw ApiError.conflict(
      `Cannot grant: a product with slug "${data.slug}" was created while this request was pending`
    );
  }
  const categories = await CategoryModel.find({ _id: { $in: data.categories } });
  if (categories.length !== data.categories.length) {
    throw ApiError.badRequest("Cannot grant: one or more categories no longer exist");
  }

  const product = new ProductModel({
    name: data.name,
    slug: data.slug,
    tagline: data.tagline,
    description: data.description,
    origin: data.origin,
    categories: data.categories,
    badge: data.badge,
    variants: data.variants,
    highlights: data.highlights,
    storageInstructions: data.storageInstructions,
    isBestSeller: data.isBestSeller,
    isFeatured: data.isFeatured,
    images: data.images,
  });
  await product.save();

  await recordAuditLog({
    actor: reviewer.id,
    actorRole: reviewer.role,
    action: "product.create",
    resource: "Product",
    resourceId: product._id.toString(),
    newValue: { name: product.name, slug: product.slug },
    note: "Applied via approval grant",
  });

  return { resource: "Product", resourceId: product._id.toString() };
});

registerPendingActionDenyHandler("product.create", async (payload, reviewer) => {
  const images = ((payload as unknown as ProductCreatePayload).images ?? []) as { publicId: string }[];
  // The Super Admin has already ruled against this submission, so its images
  // go straight to permanent deletion rather than back into the review queue
  // — routed through the registry so no row is left pointing at a deleted file.
  await purgeAssetsByPublicId(
    images.map((img) => img.publicId),
    reviewer,
    "Product creation request denied; uploaded images discarded."
  );
});

export type UpdateProductResult = {
  product: IProduct;
  /** Set when the submitted stock levels were queued for Super Admin approval. */
  stockPendingActionId?: string;
};

/**
 * Content edits (title, description, price, imagery, …) apply immediately and
 * are audit-logged. Stock is split out: for anyone but a `super_admin` the
 * live stock is carried over untouched and the submitted values are queued
 * for approval, so one submit can ship a description change instantly while
 * its stock change waits for a grant.
 */
export async function updateProduct(
  id: string,
  input: UpdateProductInput,
  actor: StockActor,
  images?: Express.Multer.File[]
): Promise<UpdateProductResult> {
  const product = await ProductModel.findById(id);
  if (!product) throw ApiError.notFound("Product not found");

  if (input.slug && input.slug !== product.slug) {
    const existing = await ProductModel.findOne({ slug: input.slug });
    if (existing) throw ApiError.conflict("A product with this slug already exists");
  }

  if (input.categories) {
    const categories = await CategoryModel.find({ _id: { $in: input.categories } });
    if (categories.length !== input.categories.length) {
      throw ApiError.badRequest("One or more categories are invalid");
    }
  }

  const fieldChanges = diffProductFields(product, input);
  const gateStock = actor.role !== "super_admin";

  // Variants are replaced wholesale on save. Carrying the existing `_id`
  // across keeps cart lines and order items — which reference a variant by
  // id — pointing at the right variant instead of being orphaned by an
  // unrelated edit. An id the form didn't get from *this* product is dropped,
  // so the variant is treated as new rather than adopting a foreign id.
  const existingById = new Map(product.variants.map((v) => [v._id!.toString(), v]));
  const { variants: submittedVariants, ...contentInput } = input;
  const requestedStocks = submittedVariants?.map((v) => v.stock) ?? [];

  Object.assign(product, contentInput);

  if (submittedVariants) {
    product.variants = submittedVariants.map(({ id, ...variant }, index) => {
      // Identity is matched strictly: only an id that really belongs to this
      // product preserves the `_id`. Anything else is a new variant.
      const matchedById = id ? existingById.get(id) : undefined;
      // Stock carry-over falls back to position, so a caller that doesn't
      // round-trip ids (an older client, a direct API call) can never silently
      // zero out a variant's stock.
      const stockSource = matchedById ?? product.variants[index];
      return {
        ...variant,
        ...(matchedById ? { _id: matchedById._id } : {}),
        // Gated roles never move stock here — the live value carries over and
        // the submitted one is queued for approval below.
        stock: gateStock ? (stockSource?.stock ?? 0) : variant.stock,
      };
    }) as IProduct["variants"];
  }

  if (input.existingImages) {
    // Granular gallery edit: keep only images the admin round-tripped
    // (identity matched by `publicId`, same "strict match, no grafting"
    // rule as variant ids above — a foreign publicId can't be used to
    // smuggle someone else's image into this product), in the order given,
    // then append any newly uploaded files. Anything dropped from the kept
    // list gets cleaned up from Cloudinary.
    const keptPublicIds = new Set(input.existingImages.map((img) => img.publicId));
    const currentByPublicId = new Map(product.images.map((img) => [img.publicId, img]));
    const kept = input.existingImages
      .filter((img) => currentByPublicId.has(img.publicId))
      .map((img) => currentByPublicId.get(img.publicId)!);
    const removed = product.images.filter((img) => !keptPublicIds.has(img.publicId));

    if (kept.length + (images?.length ?? 0) > 6) {
      throw ApiError.badRequest("A product can have at most 6 images");
    }

    await Promise.all(removed.map((img) => retireInternalAsset(img.publicId, actor, "Product image removed")));
    const uploaded = images && images.length > 0 ? await uploadProductImages(images, actor) : [];
    product.images = [...kept, ...uploaded] as IProduct["images"];
  } else if (images && images.length > 0) {
    // No `existingImages` sent — legacy wholesale replace: clean up every
    // old image and swap in the newly uploaded set.
    await Promise.all(
      product.images.map((img) => retireInternalAsset(img.publicId, actor, "Product images replaced"))
    );
    product.images = await uploadProductImages(images, actor);
  }

  await product.save();

  if (submittedVariants) {
    // Fire price-drop alerts for whichever existing variants just got cheaper.
    // Price is a content field (never stock-gated, see above), so this fires
    // the moment the save lands, same as the audit log below.
    for (const variant of product.variants) {
      const previous = existingById.get(variant._id!.toString());
      if (previous && variant.priceBDT < previous.priceBDT) {
        await notifyPriceDropSubscribers(product._id.toString(), variant._id!.toString(), variant.priceBDT);
      }
    }
  }

  if (Object.keys(fieldChanges).length > 0) {
    await recordAuditLog({
      actor: actor.id,
      actorRole: actor.role,
      action: "product.update",
      resource: "Product",
      resourceId: product._id.toString(),
      oldValue: Object.fromEntries(Object.entries(fieldChanges).map(([k, v]) => [k, v.from])),
      newValue: Object.fromEntries(Object.entries(fieldChanges).map(([k, v]) => [k, v.to])),
      note: `Edited: ${Object.keys(fieldChanges).join(", ")}`,
    });
  }

  let stockPendingActionId: string | undefined;
  if (submittedVariants && gateStock) {
    // Post-save the arrays line up one-to-one (we just built `product.variants`
    // from `submittedVariants`), so index correlation here is exact — and the
    // ids are now stable, so the queued request survives later edits.
    const stocks: DesiredVariantStock[] = product.variants
      .map((variant, index) => ({
        variantId: variant._id!.toString(),
        label: variant.label,
        stock: requestedStocks[index] ?? variant.stock,
      }))
      .filter((s, index) => s.stock !== (product.variants[index]?.stock ?? 0));

    const result = await requestVariantStockUpdate(actor, {
      productId: product._id.toString(),
      productName: product.name,
      stocks,
    });
    if (result?.kind === "pending") stockPendingActionId = result.pendingActionId;
  }

  return { product, stockPendingActionId };
}

/** Field-level product edits are logged, never gated — see `AUDITED_PRODUCT_FIELDS`. */
export { AUDITED_PRODUCT_FIELDS };
export type { AuditedProductField };

async function removeProduct(id: string, actor: AssetActor): Promise<{ id: string; name: string }> {
  const product = await ProductModel.findById(id);
  if (!product) throw ApiError.notFound("Product not found");
  const summary = { id: product._id.toString(), name: product.name };
  await Promise.all(
    product.images.map((img) => retireInternalAsset(img.publicId, actor, "Product deleted"))
  );
  await product.deleteOne();
  return summary;
}

export type DeleteProductResult = { kind: "deleted" } | { kind: "pending"; pendingActionId: string };

/**
 * Per ROLES_AND_PERMISSIONS_v2.md §6: `super_admin` deletes directly;
 * `co_admin` may only request deletion (routed through the approval gate);
 * `admin` has no product-deletion access at all — enforced at the route
 * level (see product.routes.ts) as well as here for defense in depth.
 */
export async function deleteProduct(id: string, actor: { id: string; role: Role }): Promise<DeleteProductResult> {
  if (actor.role === "co_admin") {
    const product = await ProductModel.findById(id);
    if (!product) throw ApiError.notFound("Product not found");
    const action = await createPendingAction("product.delete", { productId: id, productName: product.name }, actor);
    return { kind: "pending", pendingActionId: action._id.toString() };
  }

  const summary = await removeProduct(id, actor);
  await recordAuditLog({
    actor: actor.id,
    actorRole: actor.role,
    action: "product.delete",
    resource: "Product",
    resourceId: summary.id,
    oldValue: summary,
  });
  return { kind: "deleted" };
}

registerPendingActionHandler("product.delete", async (payload, reviewer) => {
  const productId = payload.productId as string;
  const summary = await removeProduct(productId, reviewer);
  await recordAuditLog({
    actor: reviewer.id,
    actorRole: reviewer.role,
    action: "product.delete",
    resource: "Product",
    resourceId: summary.id,
    oldValue: summary,
    note: "Applied via approval grant",
  });
  return { resource: "Product", resourceId: summary.id };
});

async function uploadProductImages(files: Express.Multer.File[], actor: AssetActor) {
  const uploaded = await Promise.all(
    files.map((file) =>
      uploadInternalFile(file, {
        folder: "saudi-authentic-product/products",
        resource: "Product",
        fieldPath: "images",
        module: "Catalog",
        actor,
      })
    )
  );
  return uploaded.map((img, index) => ({
    url: img.url,
    publicId: img.publicId,
    isPrimary: index === 0,
  }));
}

/** Recompute a product's aggregate rating from its approved reviews. */
export async function recomputeProductRating(productId: string) {
  const stats = await ReviewModel.aggregate([
    { $match: { product: new Types.ObjectId(productId), isApproved: true } },
    { $group: { _id: "$product", avg: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);

  const avg = stats[0]?.avg ?? 0;
  const count = stats[0]?.count ?? 0;

  await ProductModel.findByIdAndUpdate(productId, {
    ratingAverage: Math.round(avg * 10) / 10,
    ratingCount: count,
  });
}
