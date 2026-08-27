import { ProductQuestionModel } from "../models/ProductQuestion.model";
import { ProductModel } from "../models/Product.model";
import { ApiError } from "../utils/ApiError";
import type { CreateProductQuestionInput } from "../validators/productQuestion.validator";

export async function listQuestionsForProduct(productId: string, page: number, limit: number) {
  const skip = (page - 1) * limit;
  const filter = { product: productId };
  const [questions, total] = await Promise.all([
    ProductQuestionModel.find(filter)
      .populate("customer", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    ProductQuestionModel.countDocuments(filter),
  ]);

  return {
    questions,
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  };
}

/** All questions across every product, for staff moderation/answering. */
export async function listAllQuestions(filter: { answered?: boolean; page: number; limit: number }) {
  const query: Record<string, unknown> = {};
  if (filter.answered === true) query.answer = { $exists: true };
  if (filter.answered === false) query.answer = { $exists: false };

  const skip = (filter.page - 1) * filter.limit;
  const [questions, total] = await Promise.all([
    ProductQuestionModel.find(query)
      .populate("customer", "name email")
      .populate("product", "name slug")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(filter.limit),
    ProductQuestionModel.countDocuments(query),
  ]);

  return {
    questions,
    pagination: {
      page: filter.page,
      limit: filter.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / filter.limit)),
    },
  };
}

export async function askQuestion(productId: string, customerId: string, input: CreateProductQuestionInput) {
  const product = await ProductModel.findById(productId);
  if (!product) throw ApiError.notFound("Product not found");

  return ProductQuestionModel.create({
    product: productId,
    customer: customerId,
    question: input.question,
  });
}

export async function answerQuestion(id: string, staffId: string, answer: string) {
  const question = await ProductQuestionModel.findById(id);
  if (!question) throw ApiError.notFound("Question not found");

  question.answer = answer;
  question.answeredBy = staffId as unknown as typeof question.answeredBy;
  question.answeredAt = new Date();
  await question.save();
  return question;
}

export async function deleteQuestion(id: string) {
  const question = await ProductQuestionModel.findById(id);
  if (!question) throw ApiError.notFound("Question not found");
  await question.deleteOne();
}
