import type { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { sendSuccess } from "../utils/ApiResponse";
import { paramStr } from "../utils/params";
import { actorOf } from "../utils/actor";
import * as staticPageService from "../services/staticPage.service";
import type { StaticPageType } from "../models/StaticPage.model";

export const listPages = catchAsync(async (_req: Request, res: Response) => {
  const pages = await staticPageService.listPages();
  sendSuccess(res, 200, "Pages fetched", { pages });
});

export const getPage = catchAsync(async (req: Request, res: Response) => {
  const page = await staticPageService.getPage(paramStr(req.params.type) as StaticPageType);
  sendSuccess(res, 200, "Page fetched", { page });
});

export const updatePage = catchAsync(async (req: Request, res: Response) => {
  const page = await staticPageService.updatePage(
    paramStr(req.params.type) as StaticPageType,
    req.body,
    actorOf(req),
    req.file,
    req.user!.permissions ?? []
  );
  sendSuccess(res, 200, "Page updated", { page });
});
