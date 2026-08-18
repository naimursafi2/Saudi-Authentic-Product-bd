import { describe, expect, it } from "vitest";
import { cn, formatBDT, slugify } from "./utils";

describe("cn", () => {
  it("merges class names and resolves Tailwind conflicts", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("drops falsy values", () => {
    expect(cn("text-sm", false, undefined, null, "font-bold")).toBe("text-sm font-bold");
  });
});

describe("formatBDT", () => {
  it("formats a whole number with the Taka sign and thousands separators", () => {
    expect(formatBDT(2400)).toBe("৳ 2,400");
  });

  it("rounds fractional amounts", () => {
    expect(formatBDT(1999.6)).toBe("৳ 2,000");
  });

  it("formats zero", () => {
    expect(formatBDT(0)).toBe("৳ 0");
  });
});

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Premium Ajwa Dates")).toBe("premium-ajwa-dates");
  });

  it("strips leading/trailing separators and collapses repeats", () => {
    expect(slugify("  --Gift Box!!  ")).toBe("gift-box");
  });
});
