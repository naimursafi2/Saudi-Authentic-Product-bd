import { slugify } from "../utils/slugify";

describe("slugify", () => {
  it("lowercases and hyphenates spaces", () => {
    expect(slugify("Ajwa Dates - Premium Madinah")).toBe("ajwa-dates-premium-madinah");
  });

  it("strips leading/trailing hyphens produced by punctuation", () => {
    expect(slugify("  -Sukkari Dates!-  ")).toBe("sukkari-dates");
  });

  it("collapses repeated non-alphanumeric characters into a single hyphen", () => {
    expect(slugify("Gift   Items &&& More")).toBe("gift-items-more");
  });

  it("handles already-clean slugs unchanged", () => {
    expect(slugify("watches")).toBe("watches");
  });
});
