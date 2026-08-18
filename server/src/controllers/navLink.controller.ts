import type { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { sendSuccess } from "../utils/ApiResponse";
import { paramStr } from "../utils/params";
import * as navLinkService from "../services/navLink.service";
import type { ListNavLinksQuery } from "../validators/navLink.validator";

export const listNavLinks = catchAsync(async (req: Request, res: Response) => {
  const { includeHidden } = req.query as unknown as ListNavLinksQuery;
  const navLinks = await navLinkService.listNavLinks(includeHidden);
  sendSuccess(res, 200, "Nav links fetched", { navLinks });
});

export const createNavLink = catchAsync(async (req: Request, res: Response) => {
  const navLink = await navLinkService.createNavLink(req.body);
  sendSuccess(res, 201, "Nav link created", { navLink });
});

export const updateNavLink = catchAsync(async (req: Request, res: Response) => {
  const navLink = await navLinkService.updateNavLink(paramStr(req.params.id), req.body);
  sendSuccess(res, 200, "Nav link updated", { navLink });
});

export const deleteNavLink = catchAsync(async (req: Request, res: Response) => {
  await navLinkService.deleteNavLink(paramStr(req.params.id));
  sendSuccess(res, 200, "Nav link deleted");
});
