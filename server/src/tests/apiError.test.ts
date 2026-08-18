import { ApiError } from "../utils/ApiError";

describe("ApiError", () => {
  it("sets statusCode, message and isOperational via the constructor", () => {
    const err = new ApiError(422, "Something went wrong", { field: "bad" });
    expect(err.statusCode).toBe(422);
    expect(err.message).toBe("Something went wrong");
    expect(err.isOperational).toBe(true);
    expect(err.errors).toEqual({ field: "bad" });
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ApiError);
  });

  it.each([
    ["badRequest", 400, "Bad request"],
    ["unauthorized", 401, "Unauthorized"],
    ["forbidden", 403, "Forbidden"],
    ["notFound", 404, "Not found"],
    ["conflict", 409, "Conflict"],
    ["internal", 500, "Internal server error"],
  ] as const)("%s() produces status %i with a sensible default message", (method, status, defaultMessage) => {
    const err = ApiError[method]();
    expect(err.statusCode).toBe(status);
    expect(err.message).toBe(defaultMessage);
  });

  it("allows overriding the default message", () => {
    expect(ApiError.notFound("Product not found").message).toBe("Product not found");
  });
});
