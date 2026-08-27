import type { Request, Response } from "express";
import { errorHandler, notFoundHandler } from "../middlewares/error.middleware";
import { ApiError } from "../utils/ApiError";

function mockRes() {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe("notFoundHandler", () => {
  it("forwards a 404 ApiError describing the missing route", () => {
    const req = { method: "GET", originalUrl: "/api/v1/nope" } as Request;
    const next = jest.fn();
    notFoundHandler(req, mockRes(), next);
    const err = next.mock.calls[0][0] as ApiError;
    expect(err.statusCode).toBe(404);
    expect(err.message).toContain("GET /api/v1/nope");
  });
});

describe("errorHandler", () => {
  it("translates an ApiError into its own status code and message", () => {
    const res = mockRes();
    errorHandler(ApiError.forbidden("Nope"), {} as Request, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: "Nope" })
    );
  });

  it("translates a Mongoose ValidationError into a 400 with field messages", () => {
    const res = mockRes();
    const mongooseErr = {
      name: "ValidationError",
      errors: { name: { message: "Name is required" } },
    };
    errorHandler(mongooseErr, {} as Request, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: "Validation failed", errors: ["Name is required"] })
    );
  });

  it("translates a Mongoose duplicate key error into a 409", () => {
    const res = mockRes();
    const dupErr = { code: 11000, keyValue: { email: "a@b.com" } };
    errorHandler(dupErr, {} as Request, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "email already exists" })
    );
  });

  it("translates a JWT error into a 401", () => {
    const res = mockRes();
    errorHandler({ name: "TokenExpiredError" }, {} as Request, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("translates a Multer file-size error into a 400, not the generic 500", () => {
    const res = mockRes();
    errorHandler({ name: "MulterError", code: "LIMIT_FILE_SIZE" }, {} as Request, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining("2MB") })
    );
  });

  it("falls back to a 500 for unknown errors", () => {
    const res = mockRes();
    errorHandler(new Error("boom"), {} as Request, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "boom" }));
  });
});
