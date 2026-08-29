import type { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { sendSuccess } from "../utils/ApiResponse";
import { paramStr } from "../utils/params";
import { actorOf } from "../utils/actor";
import * as heroSlideService from "../services/heroSlide.service";
import type { ListHeroSlidesQuery } from "../validators/heroSlide.validator";

export const listHeroSlides = catchAsync(async (req: Request, res: Response) => {
  const { includeInactive } = req.query as unknown as ListHeroSlidesQuery;
  const slides = await heroSlideService.listHeroSlides(includeInactive);
  sendSuccess(res, 200, "Hero slides fetched", { slides });
});

export const createHeroSlide = catchAsync(async (req: Request, res: Response) => {
  const slide = await heroSlideService.createHeroSlide(req.body, actorOf(req), req.file);
  sendSuccess(res, 201, "Hero slide created", { slide });
});

export const updateHeroSlide = catchAsync(async (req: Request, res: Response) => {
  const slide = await heroSlideService.updateHeroSlide(
    paramStr(req.params.id),
    req.body,
    actorOf(req),
    req.file
  );
  sendSuccess(res, 200, "Hero slide updated", { slide });
});

export const deleteHeroSlide = catchAsync(async (req: Request, res: Response) => {
  await heroSlideService.deleteHeroSlide(paramStr(req.params.id), actorOf(req));
  sendSuccess(res, 200, "Hero slide deleted");
});
