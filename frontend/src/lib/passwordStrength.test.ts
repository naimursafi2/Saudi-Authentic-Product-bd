import { describe, expect, it } from "vitest";
import { getPasswordStrength, meetsPasswordRequirements } from "./passwordStrength";

describe("meetsPasswordRequirements", () => {
  it("requires 8+ chars with lower, upper and a digit", () => {
    expect(meetsPasswordRequirements("Password1")).toBe(true);
    expect(meetsPasswordRequirements("password1")).toBe(false); // no uppercase
    expect(meetsPasswordRequirements("PASSWORD1")).toBe(false); // no lowercase
    expect(meetsPasswordRequirements("Password")).toBe(false); // no digit
    expect(meetsPasswordRequirements("Pw1")).toBe(false); // too short
  });
});

describe("getPasswordStrength", () => {
  it("labels a too-short password", () => {
    expect(getPasswordStrength("Ab1").label).toBe("Too short");
  });

  it("labels a long-but-simple password as Weak", () => {
    const result = getPasswordStrength("alllowercase");
    expect(result.label).toBe("Weak");
    expect(result.checks.length).toBe(true);
    expect(result.checks.lowerUpper).toBe(false);
  });

  it("labels a password meeting exactly 3 checks as Fair", () => {
    const result = getPasswordStrength("Password1");
    expect(result.score).toBe(3);
    expect(result.label).toBe("Fair");
  });

  it("labels a password meeting all 4 checks as Strong", () => {
    const result = getPasswordStrength("Password1!");
    expect(result.score).toBe(4);
    expect(result.label).toBe("Strong");
  });
});
