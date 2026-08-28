import { z } from "zod";

export const mongoIdParamSchema = z.object({
  id: z.string().regex(/^[a-f0-9]{24}$/i, "Invalid id"),
});

export const slugParamSchema = z.object({
  slug: z.string().trim().min(1),
});

export const productIdParamSchema = z.object({
  productId: z.string().regex(/^[a-f0-9]{24}$/i, "Invalid product id"),
});

export const orderIdParamSchema = z.object({
  orderId: z.string().regex(/^[a-f0-9]{24}$/i, "Invalid order id"),
});

/**
 * `z.coerce.boolean()` treats ANY non-empty string (including "false") as
 * truthy, which silently breaks multipart/form-data bodies where every
 * field arrives as a string. This preprocesses "false"/"0" (any case) to
 * `false` before the normal coercion runs, so both JSON booleans and
 * form-data string booleans behave as expected.
 */
export const booleanish = z.preprocess((val) => {
  if (typeof val === "string") {
    const normalized = val.trim().toLowerCase();
    if (normalized === "false" || normalized === "0" || normalized === "") return false;
    if (normalized === "true" || normalized === "1") return true;
  }
  return val;
}, z.boolean());
