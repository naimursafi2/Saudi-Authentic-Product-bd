import { z } from "zod";

export const createProductQuestionSchema = z.object({
  question: z.string().trim().min(2).max(500),
});

export const answerProductQuestionSchema = z.object({
  answer: z.string().trim().min(2).max(1000),
});

export const listProductQuestionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export type CreateProductQuestionInput = z.infer<typeof createProductQuestionSchema>;
export type AnswerProductQuestionInput = z.infer<typeof answerProductQuestionSchema>;
