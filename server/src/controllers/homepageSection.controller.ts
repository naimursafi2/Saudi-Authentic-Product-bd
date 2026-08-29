import type { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { sendSuccess } from "../utils/ApiResponse";
import { paramStr } from "../utils/params";
import { actorOf } from "../utils/actor";
import * as homepageSectionService from "../services/homepageSection.service";
import type { ListHomepageSectionsQuery } from "../validators/homepageSection.validator";

export const listSections = catchAsync(async (req: Request, res: Response) => {
  const { includeHidden } = req.query as unknown as ListHomepageSectionsQuery;
  const sections = await homepageSectionService.listSections(includeHidden);
  sendSuccess(res, 200, "Homepage sections fetched", { sections });
});

export const createSection = catchAsync(async (req: Request, res: Response) => {
  const section = await homepageSectionService.createSection(req.body, actorOf(req), req.file);
  sendSuccess(res, 201, "Homepage section created", { section });
});

export const updateSection = catchAsync(async (req: Request, res: Response) => {
  const section = await homepageSectionService.updateSection(paramStr(req.params.id), req.body, actorOf(req), req.file);
  sendSuccess(res, 200, "Homepage section updated", { section });
});

export const deleteSection = catchAsync(async (req: Request, res: Response) => {
  await homepageSectionService.deleteSection(paramStr(req.params.id), actorOf(req));
  sendSuccess(res, 200, "Homepage section deleted");
});
