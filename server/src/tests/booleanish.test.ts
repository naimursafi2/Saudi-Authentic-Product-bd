import { booleanish } from "../validators/common.validator";

describe("booleanish zod schema", () => {
  it("passes through real booleans (plain JSON requests)", () => {
    expect(booleanish.parse(true)).toBe(true);
    expect(booleanish.parse(false)).toBe(false);
  });

  it('parses the string "false" as false (the multipart/form-data footgun)', () => {
    expect(booleanish.parse("false")).toBe(false);
    expect(booleanish.parse("FALSE")).toBe(false);
    expect(booleanish.parse("0")).toBe(false);
    expect(booleanish.parse("")).toBe(false);
  });

  it('parses the string "true" as true', () => {
    expect(booleanish.parse("true")).toBe(true);
    expect(booleanish.parse("TRUE")).toBe(true);
    expect(booleanish.parse("1")).toBe(true);
  });
});
