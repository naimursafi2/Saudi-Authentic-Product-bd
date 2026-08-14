import { QueryFilter, Types } from "mongoose";
import { ProductModel, type IProduct } from "../models/Product.model";
import { CategoryModel } from "../models/Category.model";
import { ReviewModel } from "../models/Review.model";
import { ApiError } from "../utils/ApiError";
import { deleteCloudinaryImage, uploadBufferToCloudinary } from "../config/cloudinary";
import { slugify } from "../utils/slugify";
import type {
  CreateProductInput,
  ListProductsQuery,
  UpdateProductInput,
} from "../validators/product.validator";

const SORT_MAP: Record<ListProductsQuery["sort"], Record<string, 1 | -1>> = {
  featured: { isFeatured: -1, createdAt: -1 },
  "price-asc": { minPriceBDT: 1 },
  "price-desc": { minPriceBDT: -1 },
  rating: { ratingAverage: -1 },
  newest: { createdAt: -1 },
};

export async function listProducts(query: ListProductsQuery) {
  const filter: QueryFilter<IProduct> = { isActive: true };

  if (query.ids && query.ids.length > 0) {
    filter._id = { $in: query.ids };
  }

  if (query.q) {
    filter.$text = { $search: query.q };
  }

  if (query.category) {
    const category = await CategoryModel.findOne({ slug: query.category });
    if (!category) {
      return {
        products: [],
        pagination: { page: query.page, limit: query.limit, total: 0, totalPages: 1 },
      };
    }
    filter.categories = category._id;
  }

  if (query.minPrice != null || query.maxPrice != null) {
    filter.minPriceBDT = {};
    if (query.minPrice != null) filter.minPriceBDT.$gte = query.minPrice;
    if (query.maxPrice != null) filter.minPriceBDT.$lte = query.maxPrice;
  }

  if (query.minRating != null) {
    filter.ratingAverage = { $gte: query.minRating };
  }

  if (query.isBestSeller != null) {
    filter.isBestSeller = query.isBestSeller;
  }

  if (query.isFeatured != null) {
    filter.isFeatured = query.isFeatured;
  }

  const skip = (query.page - 1) * query.limit;
  const [products, total] = await Promise.all([
    ProductModel.find(filter)
      .populate("categories", "name slug")
      .sort(SORT_MAP[query.sort])
      .skip(skip)
      .limit(query.limit),
    ProductModel.countDocuments(filter),
  ]);

  return {
    products,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    },
  };
}

export async function getProductBySlug(slug: string) {
  const product = await ProductModel.findOne({ slug, isActive: true }).populate(
    "categories",
    "name slug"
  );
  if (!product) throw ApiError.notFound("Product not found");
  return product;
}

export async function getProductById(id: string) {
  const product = await ProductModel.findById(id).populate("categories", "name slug");
  if (!product) throw ApiError.notFound("Product not found");
  return product;
}

export async function getRelatedProducts(product: IProduct, limit = 3) {
  return ProductModel.find({
    _id: { $ne: product._id },
    categories: { $in: product.categories },
    isActive: true,
  })
    .populate("categories", "name slug")
    .limit(limit);
}

export async function createProduct(input: CreateProductInput, images?: Express.Multer.File[]) {
  const slug = input.slug ?? slugify(input.name);
  const existing = await ProductModel.findOne({ slug });
  if (existing) throw ApiError.conflict("A product with this slug already exists");

  const categories = await CategoryModel.find({ _id: { $in: input.categories } });
  if (categories.length !== input.categories.length) {
    throw ApiError.badRequest("One or more categories are invalid");
  }

  const product = new ProductModel({ ...input, slug });

  if (images && images.length > 0) {
    product.images = await uploadProductImages(images);
  }

  await product.save();
  return product;
}

export async function updateProduct(
  id: string,
  input: UpdateProductInput,
  images?: Express.Multer.File[]
) {
  const product = await ProductModel.findById(id);
  if (!product) throw ApiError.notFound("Product not found");

  if (input.slug && input.slug !== product.slug) {
    const existing = await ProductModel.findOne({ slug: input.slug });
    if (existing) throw ApiError.conflict("A product with this slug already exists");
  }

  if (input.categories) {
    const categories = await CategoryModel.find({ _id: { $in: input.categories } });
    if (categories.length !== input.categories.length) {
      throw ApiError.badRequest("One or more categories are invalid");
    }
  }

  Object.assign(product, input);

  if (images && images.length > 0) {
    // Replacing the gallery — clean up the old images from Cloudinary.
    await Promise.all(
      product.images.map((img) => deleteCloudinaryImage(img.publicId))
    );
    product.images = await uploadProductImages(images);
  }

  await product.save();
  return product;
}

export async function deleteProduct(id: string) {
  const product = await ProductModel.findById(id);
  if (!product) throw ApiError.notFound("Product not found");
  await Promise.all(product.images.map((img) => deleteCloudinaryImage(img.publicId)));
  await product.deleteOne();
}

async function uploadProductImages(files: Express.Multer.File[]) {
  const uploaded = await Promise.all(
    files.map((file) =>
      uploadBufferToCloudinary(file.buffer, { folder: "saudi-authentic-product/products" })
    )
  );
  return uploaded.map((img, index) => ({
    url: img.url,
    publicId: img.publicId,
    isPrimary: index === 0,
  }));
}

/** Recompute a product's aggregate rating from its approved reviews. */
export async function recomputeProductRating(productId: string) {
  const stats = await ReviewModel.aggregate([
    { $match: { product: new Types.ObjectId(productId), isApproved: true } },
    { $group: { _id: "$product", avg: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);

  const avg = stats[0]?.avg ?? 0;
  const count = stats[0]?.count ?? 0;

  await ProductModel.findByIdAndUpdate(productId, {
    ratingAverage: Math.round(avg * 10) / 10,
    ratingCount: count,
  });
}
