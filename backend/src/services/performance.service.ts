import { PerformanceReviewModel } from "../models/PerformanceReview.model";
import { UserModel } from "../models/User.model";
import { ApiError } from "../utils/ApiError";
import type {
  CreatePerformanceReviewInput,
  ListPerformanceReviewsQuery,
} from "../validators/performance.validator";

export async function createPerformanceReview(reviewerId: string, input: CreatePerformanceReviewInput) {
  const employee = await UserModel.findById(input.employee);
  if (!employee || !employee.staffMeta) {
    throw ApiError.badRequest("employee must be an existing staff member");
  }

  return PerformanceReviewModel.create({ ...input, reviewer: reviewerId });
}

export async function listMyPerformanceReviews(employeeId: string, page: number, limit: number) {
  const skip = (page - 1) * limit;
  const filter = { employee: employeeId };
  const [reviews, total] = await Promise.all([
    PerformanceReviewModel.find(filter)
      .populate("reviewer", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    PerformanceReviewModel.countDocuments(filter),
  ]);
  return {
    reviews,
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  };
}

export async function listPerformanceReviews(query: ListPerformanceReviewsQuery) {
  const filter: Record<string, unknown> = {};
  if (query.employee) filter.employee = query.employee;

  const skip = (query.page - 1) * query.limit;
  const [reviews, total] = await Promise.all([
    PerformanceReviewModel.find(filter)
      .populate("employee", "name email staffMeta.employeeId")
      .populate("reviewer", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(query.limit),
    PerformanceReviewModel.countDocuments(filter),
  ]);
  return {
    reviews,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    },
  };
}
