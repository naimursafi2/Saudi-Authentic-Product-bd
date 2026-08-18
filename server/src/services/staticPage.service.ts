import { StaticPageModel, STATIC_PAGE_DEFAULTS, type StaticPageType } from "../models/StaticPage.model";
import { ApiError } from "../utils/ApiError";
import { deleteCloudinaryImage, uploadBufferToCloudinary } from "../config/cloudinary";
import type { UpdateStaticPageInput } from "../validators/staticPage.validator";

const FOLDER = "saudi-authentic-product/pages";

/** Idempotent — safe to call on every read. Only inserts docs that don't exist yet. */
async function ensureDefaultPages() {
  await Promise.all(
    STATIC_PAGE_DEFAULTS.map((def) =>
      StaticPageModel.findOneAndUpdate({ type: def.type }, { $setOnInsert: def }, { upsert: true })
    )
  );
}

export async function listPages() {
  await ensureDefaultPages();
  return StaticPageModel.find().sort({ type: 1 });
}

export async function getPage(type: StaticPageType) {
  await ensureDefaultPages();
  const page = await StaticPageModel.findOne({ type });
  if (!page) throw ApiError.notFound("Page not found");
  return page;
}

export async function updatePage(
  type: StaticPageType,
  input: UpdateStaticPageInput,
  imageFile?: Express.Multer.File
) {
  const page = await getPage(type);
  Object.assign(page, input);

  if (imageFile) {
    if (page.heroImage?.publicId) await deleteCloudinaryImage(page.heroImage.publicId);
    const uploaded = await uploadBufferToCloudinary(imageFile.buffer, { folder: FOLDER });
    page.heroImage = { url: uploaded.url, publicId: uploaded.publicId };
  }

  await page.save();
  return page;
}
