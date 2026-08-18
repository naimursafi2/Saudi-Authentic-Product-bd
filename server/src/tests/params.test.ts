import { paramStr } from "../utils/params";

describe("paramStr", () => {
  it("returns a plain string param unchanged", () => {
    expect(paramStr("abc123")).toBe("abc123");
  });

  it("takes the first element when Express parses a wildcard param as an array", () => {
    expect(paramStr(["first", "second"])).toBe("first");
  });

  it("returns an empty string for undefined", () => {
    expect(paramStr(undefined)).toBe("");
  });

  it("returns an empty string for an empty array", () => {
    expect(paramStr([])).toBe("");
  });
});
