import { z } from "zod";
import { PURCHASE_STATUSES } from "../models/Purchase.model";

const objectId = z.string().regex(/^[a-f0-9]{24}$/i, "Invalid id");

/**
 * A cost item is `name + amount + note + optional proof image` and nothing
 * else — there is no category field and no enum of allowed names on purpose.
 * Whoever records the purchase names the cost themselves, so a dates batch
 * ("Shipping", "Customs", "Transport") and a watch batch ("Parts", "Repair",
 * "Supplier Fee") both fit without a code change.
 */
export const costItemSchema = z.object({
  name: z.string().trim().min(1, "A cost name is required").max(120),
  amountBDT: z.coerce.number().min(0),
  note: z.string().trim().max(500).optional(),
});

export const createPurchaseSchema = z
  .object({
    product: objectId.optional(),
    variantId: z.string().trim().optional(),
    /**
     * Defaults to the linked product's own first category when omitted (see
     * `purchase.service.ts#createPurchase`) — only needed explicitly for a
     * batch with no catalogue link, or to override the default.
     */
    category: objectId.optional(),
    itemName: z.string().trim().max(200).optional(),
    supplierName: z.string().trim().max(160).optional(),
    purchasedAt: z.coerce.date().optional().default(() => new Date()),
    quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
    unit: z.string().trim().max(24).optional().default("pcs"),
    productCostBDT: z.coerce.number().min(0),
    note: z.string().trim().max(1000).optional(),
    /** Optional cost items supplied up front; more can be added later, unlimited. */
    costItems: z.array(costItemSchema).optional().default([]),
  })
  .refine((input) => Boolean(input.product) || Boolean(input.itemName), {
    message: "Provide either a catalogue product or an item name",
    path: ["itemName"],
  })
  .refine((input) => !input.product || Boolean(input.variantId), {
    message: "Select which variant this batch was purchased for",
    path: ["variantId"],
  });

/** Spelled out, not `.partial()`-derived — see the `updateHeroSlideSchema` note in CLAUDE.md for why a defaulted field must never be derived this way. */
export const updatePurchaseSchema = z.object({
  supplierName: z.string().trim().max(160).optional(),
  category: objectId.optional(),
  itemName: z.string().trim().min(1).max(200).optional(),
  purchasedAt: z.coerce.date().optional(),
  quantity: z.coerce.number().int().min(1).optional(),
  unit: z.string().trim().max(24).optional(),
  productCostBDT: z.coerce.number().min(0).optional(),
  note: z.string().trim().max(1000).optional(),
});

export const listPurchasesQuerySchema = z.object({
  product: objectId.optional(),
  status: z.enum(PURCHASE_STATUSES).optional(),
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const receivePurchaseSchema = z.object({
  note: z.string().trim().max(500).optional(),
});

export const costItemParamsSchema = z.object({
  id: objectId,
  costId: objectId,
});

export type CostItemInput = z.infer<typeof costItemSchema>;
export type CreatePurchaseInput = z.infer<typeof createPurchaseSchema>;
export type UpdatePurchaseInput = z.infer<typeof updatePurchaseSchema>;
export type ListPurchasesQuery = z.infer<typeof listPurchasesQuerySchema>;
export type ReceivePurchaseInput = z.infer<typeof receivePurchaseSchema>;
