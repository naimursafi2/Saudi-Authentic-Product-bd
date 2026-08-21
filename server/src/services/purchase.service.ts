import { PurchaseModel, type IPurchase } from "../models/Purchase.model";
import { ShopModel } from "../models/Shop.model";
import { ProductModel } from "../models/Product.model";
import { ApiError } from "../utils/ApiError";
import { deleteCloudinaryImage, uploadBufferToCloudinary } from "../config/cloudinary";
import { recordAuditLog } from "./auditLog.service";
import { applyPurchaseStock } from "./inventory.service";
import { createPendingAction, registerPendingActionHandler } from "./pendingAction.service";
import { assertShopAccess, resolveShopScope, type ShopActor } from "./shop.service";
import type {
  CostItemInput,
  CreatePurchaseInput,
  ListPurchasesQuery,
  UpdatePurchaseInput,
} from "../validators/purchase.validator";

const PROOF_FOLDER = "saudi-authentic-product/purchase-proofs";

export type PurchaseActor = ShopActor;

export type ReceiveResult =
  | { kind: "received"; purchase: IPurchase }
  | { kind: "pending"; purchase: IPurchase; pendingActionId: string }
  | { kind: "received_without_stock"; purchase: IPurchase };

/** `PUR-20260821-4821` — readable in a conversation, unique enough per day. */
function generateReference(): string {
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(
    now.getDate()
  ).padStart(2, "0")}`;
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `PUR-${stamp}-${suffix}`;
}

const POPULATE = [
  { path: "shop", select: "name code isActive" },
  { path: "product", select: "name slug images" },
  { path: "recordedBy", select: "name email" },
  { path: "costItems.addedBy", select: "name email" },
];

async function loadPurchase(id: string, actor: PurchaseActor): Promise<IPurchase> {
  const purchase = await PurchaseModel.findById(id);
  if (!purchase) throw ApiError.notFound("Purchase not found");
  await assertShopAccess(actor, purchase.shop.toString());
  return purchase;
}

/** Re-reads a purchase with its refs populated, for the response body. */
async function populated(id: string): Promise<IPurchase> {
  const purchase = await PurchaseModel.findById(id).populate(POPULATE);
  if (!purchase) throw ApiError.notFound("Purchase not found");
  return purchase;
}

/**
 * A purchase is only editable while it is still open. Once it is `received`
 * its stock has already landed and its unit cost is part of the historical
 * record — which is the whole point of keeping every batch separately — so
 * amending it after the fact would rewrite history rather than correct it.
 * Record a new batch instead, the same rule the append-only Investment
 * ledger follows.
 */
function assertEditable(purchase: IPurchase): void {
  if (purchase.status === "received") {
    throw ApiError.badRequest(
      "This purchase has already been received. Its cost breakdown is part of the historical record and can no longer be edited."
    );
  }
  if (purchase.status === "cancelled") {
    throw ApiError.badRequest("This purchase has been cancelled and can no longer be edited.");
  }
}

async function resolveVariant(productId: string, variantId: string) {
  const product = await ProductModel.findById(productId).select("name variants");
  if (!product) throw ApiError.notFound("Product not found");
  const variant = product.variants.find((v) => v._id?.toString() === variantId);
  if (!variant) throw ApiError.notFound("Variant not found");
  return { product, variant };
}

/** Uploads each supplied proof image and returns embeddable cost-item subdocs. */
async function buildCostItems(
  items: CostItemInput[],
  actor: PurchaseActor,
  proofFiles: Express.Multer.File[]
) {
  const byField = new Map(proofFiles.map((file) => [file.fieldname, file]));
  const built = [];
  for (const [index, item] of items.entries()) {
    const file = byField.get(`costProof${index}`);
    const proof = file
      ? await uploadBufferToCloudinary(file.buffer, { folder: PROOF_FOLDER })
      : undefined;
    built.push({
      name: item.name,
      amountBDT: item.amountBDT,
      note: item.note,
      proof: proof ? { url: proof.url, publicId: proof.publicId } : undefined,
      addedBy: actor.id,
      addedAt: new Date(),
    });
  }
  return built;
}

export async function createPurchase(
  input: CreatePurchaseInput,
  actor: PurchaseActor,
  proofFiles: Express.Multer.File[] = []
): Promise<IPurchase> {
  const shop = await ShopModel.findById(input.shop);
  if (!shop) throw ApiError.notFound("Shop not found");
  if (!shop.isActive) throw ApiError.badRequest("This shop is inactive");
  await assertShopAccess(actor, shop._id.toString());

  let itemName = input.itemName ?? "";
  let variantLabel: string | undefined;
  if (input.product && input.variantId) {
    const { product, variant } = await resolveVariant(input.product, input.variantId);
    variantLabel = variant.label;
    if (!itemName) itemName = `${product.name} - ${variant.label}`;
  }

  // Cost items supplied at creation time may each carry a proof image; the
  // files arrive as `costProof0`, `costProof1`, ... so an item without a
  // receipt does not shift the ones after it onto the wrong index.
  const costItems = await buildCostItems(input.costItems, actor, proofFiles);

  const purchase = await PurchaseModel.create({
    reference: generateReference(),
    shop: shop._id,
    product: input.product,
    variantId: input.variantId,
    variantLabel,
    itemName,
    supplierName: input.supplierName,
    purchasedAt: input.purchasedAt,
    quantity: input.quantity,
    unit: input.unit,
    productCostBDT: input.productCostBDT,
    costItems,
    note: input.note,
    status: "draft",
    recordedBy: actor.id,
    recordedByRole: actor.role,
  });

  await recordAuditLog({
    actor: actor.id,
    actorRole: actor.role,
    action: "purchase.create",
    resource: "Purchase",
    resourceId: purchase._id.toString(),
    newValue: {
      reference: purchase.reference,
      shop: shop.code,
      quantity: purchase.quantity,
      productCostBDT: purchase.productCostBDT,
      costItemCount: purchase.costItems.length,
      totalLandedCostBDT: purchase.totalLandedCostBDT,
    },
  });

  return populated(purchase._id.toString());
}

export async function listPurchases(filter: ListPurchasesQuery, actor: PurchaseActor) {
  const query: Record<string, unknown> = {};

  const scope = await resolveShopScope(actor);
  if (scope !== null) {
    // A scoped actor asking for one specific shop still only gets it if that
    // shop is in their assignment — the filter narrows, it never widens.
    query.shop = filter.shop && scope.includes(filter.shop) ? filter.shop : { $in: scope };
  } else if (filter.shop) {
    query.shop = filter.shop;
  }

  if (filter.product) query.product = filter.product;
  if (filter.status) query.status = filter.status;
  if (filter.search) {
    query.$or = [
      { reference: { $regex: filter.search, $options: "i" } },
      { itemName: { $regex: filter.search, $options: "i" } },
      { supplierName: { $regex: filter.search, $options: "i" } },
    ];
  }

  const skip = (filter.page - 1) * filter.limit;
  const [purchases, total] = await Promise.all([
    PurchaseModel.find(query)
      .populate(POPULATE)
      .sort({ purchasedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(filter.limit),
    PurchaseModel.countDocuments(query),
  ]);

  return {
    purchases,
    pagination: {
      page: filter.page,
      limit: filter.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / filter.limit)),
    },
  };
}

export async function getPurchase(id: string, actor: PurchaseActor): Promise<IPurchase> {
  await loadPurchase(id, actor);
  return populated(id);
}

export async function updatePurchase(
  id: string,
  input: UpdatePurchaseInput,
  actor: PurchaseActor
): Promise<IPurchase> {
  const purchase = await loadPurchase(id, actor);
  assertEditable(purchase);

  const before = {
    quantity: purchase.quantity,
    productCostBDT: purchase.productCostBDT,
    supplierName: purchase.supplierName,
  };
  Object.assign(purchase, input);
  await purchase.save();

  await recordAuditLog({
    actor: actor.id,
    actorRole: actor.role,
    action: "purchase.update",
    resource: "Purchase",
    resourceId: purchase._id.toString(),
    oldValue: before,
    newValue: {
      quantity: purchase.quantity,
      productCostBDT: purchase.productCostBDT,
      supplierName: purchase.supplierName,
      totalLandedCostBDT: purchase.totalLandedCostBDT,
      unitCostBDT: purchase.unitCostBDT,
    },
  });

  return populated(id);
}

// -- Custom cost items --------------------------------------------------
//
// Adding, editing and removing a cost item are ordinary writes on the
// purchase — there is no fixed list of cost types to pick from, and none
// should be added. Every total the UI shows is derived from `costItems` on
// read (see the virtuals on Purchase.model.ts), so these three functions are
// the only things that ever change a purchase's cost maths.

export async function addCostItem(
  id: string,
  input: CostItemInput,
  actor: PurchaseActor,
  proofFile?: Express.Multer.File
): Promise<IPurchase> {
  const purchase = await loadPurchase(id, actor);
  assertEditable(purchase);

  const proof = proofFile
    ? await uploadBufferToCloudinary(proofFile.buffer, { folder: PROOF_FOLDER })
    : undefined;

  purchase.costItems.push({
    name: input.name,
    amountBDT: input.amountBDT,
    note: input.note,
    proof: proof ? { url: proof.url, publicId: proof.publicId } : undefined,
    addedBy: actor.id as unknown as IPurchase["recordedBy"],
    addedAt: new Date(),
  });
  await purchase.save();

  await recordAuditLog({
    actor: actor.id,
    actorRole: actor.role,
    action: "purchase.cost.add",
    resource: "Purchase",
    resourceId: purchase._id.toString(),
    newValue: { name: input.name, amountBDT: input.amountBDT, hasProof: Boolean(proof) },
    note: `Added cost "${input.name}" to ${purchase.reference}`,
  });

  return populated(id);
}

export async function updateCostItem(
  id: string,
  costId: string,
  input: CostItemInput,
  actor: PurchaseActor,
  proofFile?: Express.Multer.File
): Promise<IPurchase> {
  const purchase = await loadPurchase(id, actor);
  assertEditable(purchase);

  const item = purchase.costItems.find((cost) => cost._id?.toString() === costId);
  if (!item) throw ApiError.notFound("Cost item not found");

  const before = { name: item.name, amountBDT: item.amountBDT, note: item.note };

  item.name = input.name;
  item.amountBDT = input.amountBDT;
  item.note = input.note;

  if (proofFile) {
    if (item.proof?.publicId) await deleteCloudinaryImage(item.proof.publicId);
    const uploaded = await uploadBufferToCloudinary(proofFile.buffer, { folder: PROOF_FOLDER });
    item.proof = { url: uploaded.url, publicId: uploaded.publicId };
  }

  await purchase.save();

  await recordAuditLog({
    actor: actor.id,
    actorRole: actor.role,
    action: "purchase.cost.update",
    resource: "Purchase",
    resourceId: purchase._id.toString(),
    oldValue: before,
    newValue: { name: item.name, amountBDT: item.amountBDT, note: item.note },
  });

  return populated(id);
}

export async function removeCostItem(
  id: string,
  costId: string,
  actor: PurchaseActor
): Promise<IPurchase> {
  const purchase = await loadPurchase(id, actor);
  assertEditable(purchase);

  const item = purchase.costItems.find((cost) => cost._id?.toString() === costId);
  if (!item) throw ApiError.notFound("Cost item not found");

  if (item.proof?.publicId) await deleteCloudinaryImage(item.proof.publicId);
  purchase.costItems = purchase.costItems.filter((cost) => cost._id?.toString() !== costId);
  await purchase.save();

  await recordAuditLog({
    actor: actor.id,
    actorRole: actor.role,
    action: "purchase.cost.remove",
    resource: "Purchase",
    resourceId: purchase._id.toString(),
    oldValue: { name: item.name, amountBDT: item.amountBDT },
  });

  return populated(id);
}

// -- Receiving ----------------------------------------------------------

async function recordReceiptAudit(purchase: IPurchase, actor: PurchaseActor, note: string) {
  await recordAuditLog({
    actor: actor.id,
    actorRole: actor.role,
    action: "purchase.receive",
    resource: "Purchase",
    resourceId: purchase._id.toString(),
    newValue: {
      reference: purchase.reference,
      quantity: purchase.quantity,
      totalLandedCostBDT: purchase.totalLandedCostBDT,
      unitCostBDT: purchase.unitCostBDT,
    },
    note,
  });
}

/**
 * Marks a batch received. When the purchase is linked to a catalogue variant
 * this also moves stock — and stock is stock, so it goes through the exact
 * same approval gate every other stock change does: `super_admin` applies it
 * immediately, everyone else (Admin included) has it parked in the pending
 * queue while the live count stays untouched. See "Stock-change approval
 * gate" in CLAUDE.md; this is deliberately not a second, softer path into
 * stock.
 *
 * A purchase with no catalogue link has no stock to move, so it is simply
 * marked received.
 */
export async function receivePurchase(
  id: string,
  actor: PurchaseActor,
  note?: string
): Promise<ReceiveResult> {
  const purchase = await loadPurchase(id, actor);

  if (purchase.status === "received") throw ApiError.badRequest("This purchase is already received");
  if (purchase.status === "cancelled") throw ApiError.badRequest("This purchase was cancelled");
  if (purchase.status === "awaiting_stock_approval") {
    throw ApiError.badRequest("This purchase is already awaiting Super Admin approval for its stock");
  }

  if (!purchase.product || !purchase.variantId) {
    purchase.status = "received";
    purchase.receivedAt = new Date();
    await purchase.save();
    await recordReceiptAudit(purchase, actor, "Received (no catalogue stock linked)");
    return { kind: "received_without_stock", purchase: await populated(id) };
  }

  if (actor.role === "super_admin") {
    await applyPurchaseStock(actor.id, {
      productId: purchase.product.toString(),
      variantId: purchase.variantId,
      quantity: purchase.quantity,
      note: note ?? `Purchase ${purchase.reference} received`,
    });
    purchase.status = "received";
    purchase.receivedAt = new Date();
    purchase.stockPendingActionId = undefined;
    await purchase.save();
    await recordReceiptAudit(purchase, actor, "Stock applied immediately");
    return { kind: "received", purchase: await populated(id) };
  }

  const action = await createPendingAction(
    "purchase.receive",
    {
      purchaseId: purchase._id.toString(),
      reference: purchase.reference,
      productId: purchase.product.toString(),
      variantId: purchase.variantId,
      variantLabel: purchase.variantLabel,
      quantity: purchase.quantity,
      unitCostBDT: purchase.unitCostBDT,
      totalLandedCostBDT: purchase.totalLandedCostBDT,
    },
    actor,
    note ?? `Receive purchase ${purchase.reference} (+${purchase.quantity} stock)`
  );

  purchase.status = "awaiting_stock_approval";
  purchase.stockPendingActionId = action._id;
  await purchase.save();

  return {
    kind: "pending",
    purchase: await populated(id),
    pendingActionId: action._id.toString(),
  };
}

export async function cancelPurchase(id: string, actor: PurchaseActor): Promise<IPurchase> {
  const purchase = await loadPurchase(id, actor);
  if (purchase.status === "received") {
    throw ApiError.badRequest("A received purchase cannot be cancelled — its stock has already landed");
  }

  purchase.status = "cancelled";
  await purchase.save();

  await recordAuditLog({
    actor: actor.id,
    actorRole: actor.role,
    action: "purchase.cancel",
    resource: "Purchase",
    resourceId: purchase._id.toString(),
    newValue: { status: "cancelled" },
  });

  return populated(id);
}

export async function deletePurchase(id: string, actor: PurchaseActor): Promise<void> {
  const purchase = await loadPurchase(id, actor);
  if (purchase.status === "received") {
    throw ApiError.badRequest(
      "A received purchase is part of the cost history and cannot be deleted. Its stock has already been applied."
    );
  }

  for (const item of purchase.costItems) {
    if (item.proof?.publicId) await deleteCloudinaryImage(item.proof.publicId);
  }
  await purchase.deleteOne();

  await recordAuditLog({
    actor: actor.id,
    actorRole: actor.role,
    action: "purchase.delete",
    resource: "Purchase",
    resourceId: id,
    oldValue: { reference: purchase.reference, totalLandedCostBDT: purchase.totalLandedCostBDT },
  });
}

/**
 * Per-product landed-cost history: every received batch of a product, newest
 * first, with the unit cost each one actually worked out to. Kept per batch
 * rather than averaged into a single number stored on the product, so a price
 * rise between shipments stays visible instead of being smoothed away.
 */
export async function getProductCostHistory(productId: string, actor: PurchaseActor) {
  const query: Record<string, unknown> = { product: productId, status: "received" };
  const scope = await resolveShopScope(actor);
  if (scope !== null) query.shop = { $in: scope };

  const purchases = await PurchaseModel.find(query).populate(POPULATE).sort({ purchasedAt: -1 });

  const totalQuantity = purchases.reduce((sum, p) => sum + p.quantity, 0);
  const totalLandedCostBDT = purchases.reduce((sum, p) => sum + p.totalLandedCostBDT, 0);

  return {
    purchases,
    totalQuantity,
    totalLandedCostBDT,
    /** Weighted across every received batch — not the mean of the per-batch unit costs. */
    averageUnitCostBDT: totalQuantity > 0 ? totalLandedCostBDT / totalQuantity : 0,
  };
}

// -- Approval-gate handler ---------------------------------------------
//
// Registered here rather than in pendingAction.service.ts: this service
// imports that one to *request* a grant, so the reverse import would be
// circular. routes/index.ts imports every router at startup, which is what
// guarantees this runs before any grant can be reviewed.
registerPendingActionHandler("purchase.receive", async (payload, reviewer) => {
  const purchaseId = payload.purchaseId as string;
  const purchase = await PurchaseModel.findById(purchaseId);
  if (!purchase) throw ApiError.notFound("Purchase not found");

  await applyPurchaseStock(reviewer.id, {
    productId: payload.productId as string,
    variantId: payload.variantId as string,
    quantity: payload.quantity as number,
    note: `Purchase ${payload.reference as string} received (approval grant)`,
  });

  purchase.status = "received";
  purchase.receivedAt = new Date();
  purchase.stockPendingActionId = undefined;
  await purchase.save();

  return { resource: "Purchase", resourceId: purchaseId };
});
