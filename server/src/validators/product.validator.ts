import { z } from "zod";
import { booleanish } from "./common.validator";

const variantSchema = z.object({
  /**
   * The existing variant's id, round-tripped by the admin form so an edit
   * keeps the same `_id` instead of minting a new one — otherwise every
   * product save orphans the `variantId` stored on existing cart lines and
   * order items. Absent for a newly added variant; an id that doesn't belong
   * to the product being edited is ignored (treated as new), so it can't be
   * used to graft a variant id in from elsewhere.
   */
  id: z.string().length(24).optional(),
  label: z.string().trim().min(1).max(40),
  priceBDT: z.number().positive(),
  compareAtPriceBDT: z.number().positive().optional(),
  stock: z.number().int().min(0).default(0),
  lowStockThreshold: z.number().int().min(0).default(10),
  sku: z.string().trim().optional(),
});

export const createProductSchema = z.object({
  name: z.string().trim().min(2).max(160),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  tagline: z.string().trim().min(2).max(240),
  description: z.string().trim().min(2),
  origin: z.string().trim().min(2).max(120),
  categories: z.array(z.string().length(24)).min(1),
  badge: z.enum(["Authentic", "Best Seller", "New", "Limited"]).optional(),
  variants: z.array(variantSchema).min(1),
  highlights: z.array(z.string().trim().min(1)).optional().default([]),
  storageInstructions: z.string().trim().optional(),
  // `booleanish` so these still parse correctly when sent as multipart/form-data
  // string fields (alongside image uploads), not just plain JSON.
  isBestSeller: booleanish.optional().default(false),
  isFeatured: booleanish.optional().default(false),
  /**
   * Update only — the gallery images to KEEP, in the order the admin wants
   * them shown; any current image whose `publicId` isn't in this list is
   * treated as removed (see product.service.ts#updateProduct). New files in
   * the `images` upload field are appended after these rather than
   * replacing them, so a save can add/remove/reorder existing photos
   * without re-uploading the whole gallery. Absent entirely (an older
   * caller that doesn't send it) falls back to the previous wholesale-
   * replace behaviour when new files are uploaded.
   */
  existingImages: z
    .array(z.object({ url: z.string(), publicId: z.string() }))
    .max(6)
    .optional(),
});

export const updateProductSchema = createProductSchema.partial();

const sortValues = [
  "featured",
  "price-asc",
  "price-desc",
  "rating",
  "newest",
] as const;

export const listProductsQuerySchema = z.object({
  q: z.string().trim().optional(),
  category: z.string().trim().optional(), // category slug
  // Comma-separated product ids — used to resolve cart/wishlist line items
  // in one request instead of one round-trip per product.
  ids: z
    .string()
    .trim()
    .optional()
    .transform((val) => (val ? val.split(",").map((id) => id.trim()).filter(Boolean) : undefined)),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().nonnegative().optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  isBestSeller: booleanish.optional(),
  isFeatured: booleanish.optional(),
  sort: z.enum(sortValues).optional().default("featured"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(12),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;
