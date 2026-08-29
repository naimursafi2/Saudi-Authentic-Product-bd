import { CategoryModel } from "../models/Category.model";
import { ApiError } from "../utils/ApiError";
import { retireInternalAsset, uploadInternalFile } from "./internalAsset.service";
import { slugify } from "../utils/slugify";
import type { AssetActor } from "./internalAsset.service";
import type { CreateCategoryInput, UpdateCategoryInput } from "../validators/category.validator";

const FOLDER = "saudi-authentic-product/categories";
const MODULE = "Categories";

export async function listCategories(includeInactive: boolean) {
  const query = includeInactive ? {} : { isActive: true };
  return CategoryModel.find(query).sort({ sortOrder: 1, name: 1 });
}

export async function getCategoryBySlug(slug: string) {
  const category = await CategoryModel.findOne({ slug });
  if (!category) throw ApiError.notFound("Category not found");
  return category;
}

export async function createCategory(
  input: CreateCategoryInput,
  actor: AssetActor,
  imageFile?: Express.Multer.File
) {
  const slug = input.slug ?? slugify(input.name);
  const existing = await CategoryModel.findOne({ slug });
  if (existing) throw ApiError.conflict("A category with this slug already exists");

  const category = new CategoryModel({ ...input, slug });

  if (imageFile) {
    const uploaded = await uploadInternalFile(imageFile, {
      folder: FOLDER,
      resource: "Category",
      fieldPath: "image",
      module: MODULE,
      actor,
    });
    category.image = { url: uploaded.url, publicId: uploaded.publicId };
  }

  await category.save();
  return category;
}

export async function updateCategory(
  id: string,
  input: UpdateCategoryInput,
  actor: AssetActor,
  imageFile?: Express.Multer.File
) {
  const category = await CategoryModel.findById(id);
  if (!category) throw ApiError.notFound("Category not found");

  if (input.slug && input.slug !== category.slug) {
    const existing = await CategoryModel.findOne({ slug: input.slug });
    if (existing) throw ApiError.conflict("A category with this slug already exists");
  }

  Object.assign(category, input);

  if (imageFile) {
    // The replaced image is not destroyed — it enters the internal-asset
    // lifecycle so a Super Admin can still recover it.
    await retireInternalAsset(category.image?.publicId, actor, "Category image replaced");
    const uploaded = await uploadInternalFile(imageFile, {
      folder: FOLDER,
      resource: "Category",
      resourceId: id,
      fieldPath: "image",
      module: MODULE,
      actor,
    });
    category.image = { url: uploaded.url, publicId: uploaded.publicId };
  }

  await category.save();
  return category;
}

export async function deleteCategory(id: string, actor: AssetActor) {
  const category = await CategoryModel.findById(id);
  if (!category) throw ApiError.notFound("Category not found");
  await retireInternalAsset(category.image?.publicId, actor, "Category deleted");
  await category.deleteOne();
}
