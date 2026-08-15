import { HeroSlideModel } from "../models/HeroSlide.model";
import { ApiError } from "../utils/ApiError";
import { deleteCloudinaryImage, uploadBufferToCloudinary } from "../config/cloudinary";
import type { CreateHeroSlideInput, UpdateHeroSlideInput } from "../validators/heroSlide.validator";

const FOLDER = "saudi-authentic-product/hero-slides";

export async function listHeroSlides(includeInactive: boolean) {
  const query = includeInactive ? {} : { isActive: true };
  return HeroSlideModel.find(query).sort({ sortOrder: 1, createdAt: 1 });
}

export async function createHeroSlide(input: CreateHeroSlideInput, imageFile?: Express.Multer.File) {
  if (!imageFile) throw ApiError.badRequest("A hero slide image is required");

  const uploaded = await uploadBufferToCloudinary(imageFile.buffer, { folder: FOLDER });
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
  imageFile?: Express.Multer.File
) {
  const slide = await HeroSlideModel.findById(id);
  if (!slide) throw ApiError.notFound("Hero slide not found");

  Object.assign(slide, input);

  if (imageFile) {
    if (slide.image?.publicId) await deleteCloudinaryImage(slide.image.publicId);
    const uploaded = await uploadBufferToCloudinary(imageFile.buffer, { folder: FOLDER });
    slide.image = { url: uploaded.url, publicId: uploaded.publicId };
  }

  await slide.save();
  return slide;
}

export async function deleteHeroSlide(id: string) {
  const slide = await HeroSlideModel.findById(id);
  if (!slide) throw ApiError.notFound("Hero slide not found");
  if (slide.image?.publicId) await deleteCloudinaryImage(slide.image.publicId);
  await slide.deleteOne();
}
