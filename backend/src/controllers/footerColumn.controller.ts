import type { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { sendSuccess } from "../utils/ApiResponse";
import { paramStr } from "../utils/params";
import * as footerColumnService from "../services/footerColumn.service";
import type { ListFooterColumnsQuery } from "../validators/footerColumn.validator";

export const listFooterColumns = catchAsync(async (req: Request, res: Response) => {
  const { includeHidden } = req.query as unknown as ListFooterColumnsQuery;
  const footerColumns = await footerColumnService.listFooterColumns(includeHidden);
  sendSuccess(res, 200, "Footer columns fetched", { footerColumns });
});

export const createFooterColumn = catchAsync(async (req: Request, res: Response) => {
  const footerColumn = await footerColumnService.createFooterColumn(req.body);
  sendSuccess(res, 201, "Footer column created", { footerColumn });
});

export const updateFooterColumn = catchAsync(async (req: Request, res: Response) => {
  const footerColumn = await footerColumnService.updateFooterColumn(paramStr(req.params.id), req.body);
  sendSuccess(res, 200, "Footer column updated", { footerColumn });
});

export const deleteFooterColumn = catchAsync(async (req: Request, res: Response) => {
  await footerColumnService.deleteFooterColumn(paramStr(req.params.id));
  sendSuccess(res, 200, "Footer column deleted");
});
