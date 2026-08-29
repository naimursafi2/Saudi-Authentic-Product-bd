import { HeroSlideModel } from "../models/HeroSlide.model";
import { ApiError } from "../utils/ApiError";
import { retireInternalAsset, uploadInternalFile, type AssetActor } from "./internalAsset.service";
import type { CreateHeroSlideInput, UpdateHeroSlideInput } from "../validators/heroSlide.validator";

const FOLDER = "saudi-authentic-product/hero-slides";
const MODULE = "Homepage";

export async function listHeroSlides(includeInactive: boolean) {
  const query = includeInactive ? {} : { isActive: true };
  return HeroSlideModel.find(query).sort({ sortOrder: 1, createdAt: 1 });
}

export async function createHeroSlide(
  input: CreateHeroSlideInput,
  actor: AssetActor,
  imageFile?: Express.Multer.File
) {
  if (!imageFile) throw ApiError.badRequest("A hero slide image is required");

  const uploaded = await uploadInternalFile(imageFile, {
    folder: FOLDER,
    resource: "HeroSlide",
    fieldPath: "image",
    module: MODULE,
    actor,
  });
  const slide = new HeroSlideModel({
    ...input,
    image: { url: uploaded.url, publicId: uploaded.publicId },
  });
  await slide.save();
  return slide;
}

export async function updateHeroSlide(
  id: string,
  input: UpdateHeroSlideInput,
  actor: AssetActor,
  imageFile?: Express.Multer.File
) {
  const slide = await HeroSlideModel.findById(id);
  if (!slide) throw ApiError.notFound("Hero slide not found");

  Object.assign(slide, input);

  if (imageFile) {
    await retireInternalAsset(slide.image?.publicId, actor, "Hero slide image replaced");
    const uploaded = await uploadInternalFile(imageFile, {
      folder: FOLDER,
      resource: "HeroSlide",
      resourceId: id,
      fieldPath: "image",
      module: MODULE,
      actor,
    });
    slide.image = { url: uploaded.url, publicId: uploaded.publicId };
  }

  await slide.save();
  return slide;
}

export async function deleteHeroSlide(id: string, actor: AssetActor) {
  const slide = await HeroSlideModel.findById(id);
  if (!slide) throw ApiError.notFound("Hero slide not found");
  await retireInternalAsset(slide.image?.publicId, actor, "Hero slide deleted");
  await slide.deleteOne();
}
