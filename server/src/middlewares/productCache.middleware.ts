import type { NextFunction, Request, Response } from "express";
import { revalidateFrontendTag } from "../utils/revalidateFrontend";

/**
 * The storefront caches product listings and product pages (Next.js Data
 * Cache, tag "products") so visitors get them instantly instead of waiting on
 * this API every time. Any successful write that can change what a product
 * page shows — product edits, stock moves, orders (stock), approvals,
 * purchases, returns, reviews (rating) — tells the frontend to refresh that
 * cache. Fire-and-forget; see utils/revalidateFrontend.ts.
 */
const PRODUCT_AFFECTING_PREFIXES = [
  "/products",
  "/inventory",
  "/orders",
  "/pending-actions",
  "/purchases",
  "/returns",
  "/reviews",
];

export function bustProductCacheOnWrite(req: Request, res: Response, next: NextFunction) {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return next();
  if (!PRODUCT_AFFECTING_PREFIXES.some((prefix) => req.path.startsWith(prefix))) return next();

  res.on("finish", () => {
    if (res.statusCode < 400) revalidateFrontendTag("products");
  });
  next();
}
