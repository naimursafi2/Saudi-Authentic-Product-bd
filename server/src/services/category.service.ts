import { CategoryModel } from "../models/Category.model";
import { ApiError } from "../utils/ApiError";
import { deleteCloudinaryImage, uploadBufferToCloudinary } from "../config/cloudinary";
import { slugify } from "../utils/slugify";
import type { CreateCategoryInput, UpdateCategoryInput } from "../validators/category.validator";

export async function listCategories(includeInactive: boolean) {
  const query = includeInactive ? {} : { isActive: true };
  return CategoryModel.find(query).sort({ sortOrder: 1, name: 1 });
}

export async function getCategoryBySlug(slug: string) {
  const category = await CategoryModel.findOne({ slug });
  if (!category) throw ApiError.notFound("Category not found");
  return category;
}

export async function createCategory(input: CreateCategoryInput, imageFile?: Express.Multer.File) {
  const slug = input.slug ?? slugify(input.name);
  const existing = await CategoryModel.findOne({ slug });
  if (existing) throw ApiError.conflict("A category with this slug already exists");

  const category = new CategoryModel({ ...input, slug });

  if (imageFile) {
    const uploaded = await uploadBufferToCloudinary(imageFile.buffer, {
      folder: "saudi-authentic-product/categories",
    });
    category.image = { url: uploaded.url, publicId: uploaded.publicId };
  }

  await category.save();
  return category;
}

export async function updateCategory(
  id: string,
  input: UpdateCategoryInput,
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
    if (category.image?.publicId) {
      await deleteCloudinaryImage(category.image.publicId);
    }
    const uploaded = await uploadBufferToCloudinary(imageFile.buffer, {
      folder: "saudi-authentic-product/categories",
    });
    category.image = { url: uploaded.url, publicId: uploaded.publicId };
  }

  await category.save();
  return category;
}

export async function deleteCategory(id: string) {
  const category = await CategoryModel.findById(id);
  if (!category) throw ApiError.notFound("Category not found");
  if (category.image?.publicId) {
    await deleteCloudinaryImage(category.image.publicId);
  }
  await category.deleteOne();
}
