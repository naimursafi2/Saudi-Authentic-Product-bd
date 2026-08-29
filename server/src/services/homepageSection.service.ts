import {
  HomepageSectionModel,
  HOMEPAGE_SECTION_DEFAULTS,
  type HomepageSectionType,
} from "../models/HomepageSection.model";
import { ApiError } from "../utils/ApiError";
import { retireInternalAsset, uploadInternalFile, type AssetActor } from "./internalAsset.service";
import type {
  CreateHomepageSectionInput,
  UpdateHomepageSectionInput,
} from "../validators/homepageSection.validator";

const FOLDER = "saudi-authentic-product/homepage";
const MODULE = "Homepage";
const CREATABLE_TYPES: HomepageSectionType[] = ["promoBanner", "productShowcase", "banner"];

/** Idempotent — safe to call on every list request. Only inserts docs that don't exist yet. */
async function ensureDefaultSections() {
  await Promise.all(
    HOMEPAGE_SECTION_DEFAULTS.map((def) =>
      HomepageSectionModel.findOneAndUpdate(
        { type: def.type },
        { $setOnInsert: def },
        { upsert: true }
      )
    )
  );
}

export async function listSections(includeHidden: boolean) {
  await ensureDefaultSections();
  const query = includeHidden ? {} : { isVisible: true };
  return HomepageSectionModel.find(query).sort({ sortOrder: 1 });
}

export async function createSection(
  input: CreateHomepageSectionInput,
  actor: AssetActor,
  imageFile?: Express.Multer.File
) {
  const { type, ...rest } = input;
  if (!CREATABLE_TYPES.includes(type)) {
    throw ApiError.badRequest(`Homepage sections of type "${type}" can't be created directly`);
  }

  const section = new HomepageSectionModel({ ...rest, type });

  if (imageFile) {
    const uploaded = await uploadInternalFile(imageFile, { folder: FOLDER, resource: "HomepageSection", fieldPath: "image", module: MODULE, actor });
    section.image = { url: uploaded.url, publicId: uploaded.publicId };
  }

  await section.save();
  return section;
}

export async function updateSection(
  id: string,
  input: UpdateHomepageSectionInput,
  actor: AssetActor,
  imageFile?: Express.Multer.File
) {
  const section = await HomepageSectionModel.findById(id);
  if (!section) throw ApiError.notFound("Homepage section not found");

  Object.assign(section, input);

  if (imageFile) {
    await retireInternalAsset(section.image?.publicId, actor, "Homepage section image replaced");
    const uploaded = await uploadInternalFile(imageFile, { folder: FOLDER, resource: "HomepageSection", resourceId: id, fieldPath: "image", module: MODULE, actor });
    section.image = { url: uploaded.url, publicId: uploaded.publicId };
  }

  await section.save();
  return section;
}

export async function deleteSection(id: string, actor: AssetActor) {
  const section = await HomepageSectionModel.findById(id);
  if (!section) throw ApiError.notFound("Homepage section not found");
  if (!CREATABLE_TYPES.includes(section.type)) {
    throw ApiError.badRequest(
      "Fixed homepage sections can't be deleted — hide them instead by turning visibility off."
    );
  }
  await retireInternalAsset(section.image?.publicId, actor, "Homepage section deleted");
  await section.deleteOne();
}
