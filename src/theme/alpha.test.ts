import { describe, expect, it } from "vitest";
import { alpha } from "./alpha";

describe("alpha", () => {
  it("mixes a hex colour with transparent", () => {
    expect(alpha("#34d399", 13)).toBe("color-mix(in oklab, #34d399 13%, transparent)");
  });

  it("accepts a CSS variable", () => {
    expect(alpha("var(--color-cat-creational)", 33)).toBe(
      "color-mix(in oklab, var(--color-cat-creational) 33%, transparent)",
    );
  });

  it("trims floating-point noise", () => {
    expect(alpha("#fff", 0x22 / 2.55)).toBe("color-mix(in oklab, #fff 13.33%, transparent)");
  });

  it("allows the 0 and 100 bounds", () => {
    expect(alpha("red", 0)).toContain(" 0%");
    expect(alpha("red", 100)).toContain(" 100%");
  });

  it("rejects out-of-range and NaN percentages", () => {
    expect(() => alpha("red", -1)).toThrow(RangeError);
    expect(() => alpha("red", 101)).toThrow(RangeError);
    expect(() => alpha("red", Number.NaN)).toThrow(RangeError);
  });
});
