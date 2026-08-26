import type { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { sendSuccess } from "../utils/ApiResponse";
import { paramStr } from "../utils/params";
import * as productService from "../services/product.service";
import type { ListProductsQuery } from "../validators/product.validator";

export const listProducts = catchAsync(async (req: Request, res: Response) => {
  const query = req.query as unknown as ListProductsQuery;
  const { products, pagination } = await productService.listProducts(query);
  sendSuccess(res, 200, "Products fetched", { products }, { pagination });
});

export const getProduct = catchAsync(async (req: Request, res: Response) => {
  const product = await productService.getProductBySlug(paramStr(req.params.slug));
  const related = await productService.getRelatedProducts(product);
  sendSuccess(res, 200, "Product fetched", { product, related });
});

export const createProduct = catchAsync(async (req: Request, res: Response) => {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  const actor = { id: req.user!.id, role: req.user!.role };
  const result = await productService.createProduct(req.body, actor, files);
  if (result.kind === "pending") {
    sendSuccess(
      res,
      202,
      "Product submitted for Super Admin approval — it will not appear in the catalog until granted",
      { pendingActionId: result.pendingActionId }
    );
    return;
  }
  sendSuccess(res, 201, "Product created", { product: result.product });
});

export const updateProduct = catchAsync(async (req: Request, res: Response) => {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  const actor = { id: req.user!.id, role: req.user!.role };
  const { product, stockPendingActionId } = await productService.updateProduct(
    paramStr(req.params.id),
    req.body,
    actor,
    files
  );
  sendSuccess(
    res,
    200,
    stockPendingActionId
      ? "Product updated — the stock change needs Super Admin approval before going live"
      : "Product updated",
    { product, stockPendingActionId }
  );
});

export const deleteProduct = catchAsync(async (req: Request, res: Response) => {
  const result = await productService.deleteProduct(paramStr(req.params.id), {
    id: req.user!.id,
    role: req.user!.role,
  });
  if (result.kind === "pending") {
    sendSuccess(res, 202, "Product deletion requires Super Admin approval — submitted for review", {
      pendingActionId: result.pendingActionId,
    });
    return;
  }
  sendSuccess(res, 200, "Product deleted");
});

export const getProductForAdmin = catchAsync(async (req: Request, res: Response) => {
  const product = await productService.getProductById(paramStr(req.params.id));
  sendSuccess(res, 200, "Product fetched", { product });
});
