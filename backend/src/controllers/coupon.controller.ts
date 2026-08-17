import type { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { sendSuccess } from "../utils/ApiResponse";
import { paramStr } from "../utils/params";
import * as couponService from "../services/coupon.service";
import type { ListCouponsQuery, ValidateCouponInput } from "../validators/coupon.validator";

export const listCoupons = catchAsync(async (req: Request, res: Response) => {
  const { status, search, page, limit } = req.query as unknown as ListCouponsQuery;
  const { coupons, pagination } = await couponService.listCoupons({ status, search, page, limit });
  const withStatus = coupons.map((coupon) => ({
    ...coupon.toObject(),
    status: couponService.computeCouponStatus(coupon),
  }));
  sendSuccess(res, 200, "Coupons fetched", { coupons: withStatus }, { pagination });
});

export const createCoupon = catchAsync(async (req: Request, res: Response) => {
  const coupon = await couponService.createCoupon(req.body);
  sendSuccess(res, 201, "Coupon created", { coupon });
});

export const updateCoupon = catchAsync(async (req: Request, res: Response) => {
  const coupon = await couponService.updateCoupon(paramStr(req.params.id), req.body);
  sendSuccess(res, 200, "Coupon updated", { coupon });
});

export const deleteCoupon = catchAsync(async (req: Request, res: Response) => {
  await couponService.deleteCoupon(paramStr(req.params.id));
  sendSuccess(res, 200, "Coupon deleted");
});

export const validateCoupon = catchAsync(async (req: Request, res: Response) => {
  const { code, subtotalBDT } = req.body as ValidateCouponInput;
  const { coupon, discountBDT } = await couponService.validateCouponForOrder(code, subtotalBDT);
  sendSuccess(res, 200, "Coupon applied", {
    code: coupon.code,
    discountType: coupon.discountType,
    discountValue: coupon.discountValue,
    discountBDT,
  });
});
