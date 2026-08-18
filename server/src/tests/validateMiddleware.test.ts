import { z } from "zod";
import type { Request, Response } from "express";
import { validate } from "../middlewares/validate.middleware";
import { ApiError } from "../utils/ApiError";

describe("validate middleware", () => {
  const bodySchema = z.object({ name: z.string().min(2) });

  it("calls next() with no error and coerces the body on success", () => {
    const req = { body: { name: "Ajwa" } } as Request;
    const next = jest.fn();
    validate({ body: bodySchema })(req, {} as Response, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.body).toEqual({ name: "Ajwa" });
  });

  it("forwards a 400 ApiError with field errors on validation failure", () => {
    const req = { body: { name: "A" } } as Request;
    const next = jest.fn();
    validate({ body: bodySchema })(req, {} as Response, next);
    const err = next.mock.calls[0][0] as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.statusCode).toBe(400);
    expect(err.errors).toHaveProperty("name");
  });

  it("coerces query params (e.g. page/limit strings to numbers)", () => {
    const querySchema = z.object({ page: z.coerce.number().int().min(1).default(1) });
    const req = { query: { page: "3" } } as unknown as Request;
    const next = jest.fn();
    validate({ query: querySchema })(req, {} as Response, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.query).toEqual({ page: 3 });
  });
});
