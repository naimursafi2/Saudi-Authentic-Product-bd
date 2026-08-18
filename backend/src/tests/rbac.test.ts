import type { NextFunction, Request, Response } from "express";
import { authorize, authorizeSelfOrRoles } from "../middlewares/rbac.middleware";
import { ApiError } from "../utils/ApiError";

function mockReq(user?: Request["user"]): Request {
  return { user } as unknown as Request;
}

const res = {} as Response;

describe("authorize middleware", () => {
  it("calls next() with no error when the user has an allowed role", () => {
    const req = mockReq({ id: "u1", role: "admin", tokenVersion: 0, isEmailVerified: true });
    const next = jest.fn();
    authorize("admin", "super_admin")(req, res, next as NextFunction);
    expect(next).toHaveBeenCalledWith();
  });

  it("calls next() with a 403 ApiError when the role is not allowed", () => {
    const req = mockReq({ id: "u1", role: "customer", tokenVersion: 0, isEmailVerified: true });
    const next = jest.fn();
    authorize("admin", "super_admin")(req, res, next as NextFunction);
    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0] as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.statusCode).toBe(403);
  });

  it("calls next() with a 401 ApiError when there is no authenticated user", () => {
    const req = mockReq(undefined);
    const next = jest.fn();
    authorize("admin")(req, res, next as NextFunction);
    const err = next.mock.calls[0][0] as ApiError;
    expect(err.statusCode).toBe(401);
  });

  it("recognises the order_manager and delivery_agent roles", () => {
    const managerReq = mockReq({ id: "u1", role: "order_manager", tokenVersion: 0, isEmailVerified: true });
    const managerNext = jest.fn();
    authorize("order_manager", "co_admin")(managerReq, res, managerNext as NextFunction);
    expect(managerNext).toHaveBeenCalledWith();

    const agentReq = mockReq({ id: "u2", role: "delivery_agent", tokenVersion: 0, isEmailVerified: true });
    const agentNext = jest.fn();
    authorize("delivery_agent")(agentReq, res, agentNext as NextFunction);
    expect(agentNext).toHaveBeenCalledWith();

    // a delivery agent is never implicitly granted order_manager-only routes
    const deniedNext = jest.fn();
    authorize("order_manager", "co_admin")(agentReq, res, deniedNext as NextFunction);
    const err = deniedNext.mock.calls[0][0] as ApiError;
    expect(err.statusCode).toBe(403);
  });
});

describe("authorizeSelfOrRoles middleware", () => {
  const getOwnerId = (req: Request) => (req.params as { userId?: string }).userId;

  it("allows the request through when the user owns the resource", () => {
    const req = {
      user: { id: "u1", role: "customer", tokenVersion: 0 },
      params: { userId: "u1" },
    } as unknown as Request;
    const next = jest.fn();
    authorizeSelfOrRoles(getOwnerId, "admin")(req, res, next as NextFunction);
    expect(next).toHaveBeenCalledWith();
  });

  it("allows the request through when the user has a staff role, even if not the owner", () => {
    const req = {
      user: { id: "staff1", role: "admin", tokenVersion: 0 },
      params: { userId: "someone-else" },
    } as unknown as Request;
    const next = jest.fn();
    authorizeSelfOrRoles(getOwnerId, "admin")(req, res, next as NextFunction);
    expect(next).toHaveBeenCalledWith();
  });

  it("blocks the request when the user neither owns the resource nor has a staff role", () => {
    const req = {
      user: { id: "u1", role: "customer", tokenVersion: 0 },
      params: { userId: "someone-else" },
    } as unknown as Request;
    const next = jest.fn();
    authorizeSelfOrRoles(getOwnerId, "admin")(req, res, next as NextFunction);
    const err = next.mock.calls[0][0] as ApiError;
    expect(err.statusCode).toBe(403);
  });
});
