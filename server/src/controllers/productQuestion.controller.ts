import type { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { sendSuccess } from "../utils/ApiResponse";
import { paramStr } from "../utils/params";
import * as productQuestionService from "../services/productQuestion.service";
import { getProductById } from "../services/product.service";
import type { AnswerProductQuestionInput, CreateProductQuestionInput } from "../validators/productQuestion.validator";

export const listQuestions = catchAsync(async (req: Request, res: Response) => {
  const { page, limit } = req.query as unknown as { page: number; limit: number };
  const { questions, pagination } = await productQuestionService.listQuestionsForProduct(
    paramStr(req.params.productId),
    page,
    limit
  );
  sendSuccess(res, 200, "Questions fetched", { questions }, { pagination });
});

export const listAllQuestions = catchAsync(async (req: Request, res: Response) => {
  const { page, limit } = req.query as unknown as { page: number; limit: number };
  const { answered } = req.query as { answered?: string };
  const { questions, pagination } = await productQuestionService.listAllQuestions({
    answered: answered === "true" ? true : answered === "false" ? false : undefined,
    page,
    limit,
  });
  sendSuccess(res, 200, "Questions fetched", { questions }, { pagination });
});

export const askQuestion = catchAsync(async (req: Request, res: Response) => {
  const productId = paramStr(req.params.productId);
  await getProductById(productId);
  const input = req.body as CreateProductQuestionInput;
  const question = await productQuestionService.askQuestion(productId, req.user!.id, input);
  sendSuccess(res, 201, "Question submitted", { question });
});

export const answerQuestion = catchAsync(async (req: Request, res: Response) => {
  const { answer } = req.body as AnswerProductQuestionInput;
  const question = await productQuestionService.answerQuestion(paramStr(req.params.id), req.user!.id, answer);
  sendSuccess(res, 200, "Question answered", { question });
});

export const deleteQuestion = catchAsync(async (req: Request, res: Response) => {
  await productQuestionService.deleteQuestion(paramStr(req.params.id));
  sendSuccess(res, 200, "Question deleted");
});
