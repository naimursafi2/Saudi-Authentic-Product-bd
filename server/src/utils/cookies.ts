import type { Response } from "express";
import { env, isProduction } from "../config/env";

const REFRESH_COOKIE_PATH = `${env.API_PREFIX}/auth/refresh`;

const ACCESS_TOKEN_MAX_AGE_MS = 15 * 60 * 1000; // 15 minutes
const REFRESH_TOKEN_MAX_AGE_MS = 15 * 24 * 60 * 60 * 1000; // 15 days

function baseCookieOptions() {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: (isProduction ? "none" : "lax") as "none" | "lax",
    path: "/",
  };
}

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  res.cookie("accessToken", accessToken, {
    ...baseCookieOptions(),
    maxAge: ACCESS_TOKEN_MAX_AGE_MS,
  });
  res.cookie("refreshToken", refreshToken, {
    ...baseCookieOptions(),
    maxAge: REFRESH_TOKEN_MAX_AGE_MS,
    path: REFRESH_COOKIE_PATH,
  });
}

export function clearAuthCookies(res: Response) {
  res.clearCookie("accessToken", baseCookieOptions());
  res.clearCookie("refreshToken", { ...baseCookieOptions(), path: REFRESH_COOKIE_PATH });
}
