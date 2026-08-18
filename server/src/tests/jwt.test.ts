import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  type JwtPayload,
} from "../utils/jwt";

const payload: JwtPayload = { sub: "64f0a1b2c3d4e5f6a7b8c9d0", role: "customer", tokenVersion: 0 };

describe("jwt utils", () => {
  it("round-trips a payload through sign/verify for access tokens", () => {
    const token = signAccessToken(payload);
    const decoded = verifyAccessToken(token);
    expect(decoded.sub).toBe(payload.sub);
    expect(decoded.role).toBe(payload.role);
    expect(decoded.tokenVersion).toBe(payload.tokenVersion);
  });

  it("round-trips a payload through sign/verify for refresh tokens", () => {
    const token = signRefreshToken(payload);
    const decoded = verifyRefreshToken(token);
    expect(decoded.sub).toBe(payload.sub);
  });

  it("rejects an access token when verified with the refresh verifier", () => {
    const token = signAccessToken(payload);
    expect(() => verifyRefreshToken(token)).toThrow();
  });

  it("rejects a tampered token", () => {
    const token = signAccessToken(payload);
    const tampered = `${token.slice(0, -2)}xx`;
    expect(() => verifyAccessToken(tampered)).toThrow();
  });
});
