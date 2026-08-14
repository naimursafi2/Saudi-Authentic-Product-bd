import { ReviewModel } from "../models/Review.model";
import { ProductModel } from "../models/Product.model";
import { ApiError } from "../utils/ApiError";
import { recomputeProductRating } from "./product.service";
import type { CreateReviewInput } from "../validators/review.validator";

export async function listReviewsForProduct(productId: string, page: number, limit: number) {
  const skip = (page - 1) * limit;
  const filter = { product: productId, isApproved: true };
  const [reviews, total] = await Promise.all([
    ReviewModel.find(filter)
      .populate("customer", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    ReviewModel.countDocuments(filter),
  ]);

  return {
    reviews,
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  };
}

/** All reviews across every product, for admin moderation (approved and unapproved). */
export async function listAllReviews(page: number, limit: number) {
  const skip = (page - 1) * limit;
  const [reviews, total] = await Promise.all([
    ReviewModel.find({})
      .populate("customer", "name email")
      .populate("product", "name slug")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    ReviewModel.countDocuments({}),
  ]);
  return {
    reviews,
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  };
}

/** Most recent approved reviews across all products — homepage testimonials. */
export async function listRecentReviews(limit: number) {
  return ReviewModel.find({ isApproved: true })
    .populate("customer", "name")
    .sort({ createdAt: -1 })
    .limit(limit);
}

export async function createReview(
  productId: string,
  customerId: string,
  input: CreateReviewInput
) {
  const product = await ProductModel.findById(productId);
  if (!product) throw ApiError.notFound("Product not found");

  const existing = await ReviewModel.findOne({ product: productId, customer: customerId });
  if (existing) {
    throw ApiError.conflict("You have already reviewed this product");
  }

  const review = await ReviewModel.create({
    product: productId,
    customer: customerId,
    rating: input.rating,
    comment: input.comment,
  });

  await recomputeProductRating(productId);
  return review;
}

export async function deleteReview(reviewId: string) {
  const review = await ReviewModel.findById(reviewId);
  if (!review) throw ApiError.notFound("Review not found");
  const productId = review.product.toString();
  await review.deleteOne();
  await recomputeProductRating(productId);
}
