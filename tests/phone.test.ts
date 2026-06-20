import { describe, it, expect } from "vitest";
import { formatRuPhone, ruPhoneHref, maskRuPhone } from "@/lib/phone";

describe("formatRuPhone", () => {
  it("normalizes 8-/7-/10-digit inputs to one mask", () => {
    expect(formatRuPhone("89051234567")).toBe("+7 (905) 123-45-67");
    expect(formatRuPhone("79051234567")).toBe("+7 (905) 123-45-67");
    expect(formatRuPhone("9051234567")).toBe("+7 (905) 123-45-67");
  });

  it("returns empty for null/empty", () => {
    expect(formatRuPhone(null)).toBe("");
    expect(formatRuPhone("")).toBe("");
  });

  it("leaves unrecognized values untouched (trimmed)", () => {
    expect(formatRuPhone("12345")).toBe("12345");
    expect(formatRuPhone("  hello ")).toBe("hello");
  });
});

describe("ruPhoneHref", () => {
  it("builds a +7 tel href for recognizable RU numbers", () => {
    expect(ruPhoneHref("89051234567")).toBe("+79051234567");
    expect(ruPhoneHref("9051234567")).toBe("+79051234567");
  });
});

describe("maskRuPhone", () => {
  it("is idempotent on an already-masked value", () => {
    const once = maskRuPhone("9051234567");
    expect(once).toBe("+7 (905) 123-45-67");
    expect(maskRuPhone(once)).toBe(once);
  });

  it("returns empty for empty input", () => {
    expect(maskRuPhone("")).toBe("");
    expect(maskRuPhone(null)).toBe("");
  });
});
