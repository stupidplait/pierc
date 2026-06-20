import { describe, it, expect } from "vitest";
import {
  asPhotos,
  firstPhotoUrl,
  genPhotoUrls,
  formatPrice,
} from "@/lib/jewelry/format";

describe("asPhotos", () => {
  it("returns [] for non-array input", () => {
    expect(asPhotos(null)).toEqual([]);
    expect(asPhotos("nope")).toEqual([]);
    expect(asPhotos({})).toEqual([]);
  });

  it("keeps valid url entries and defaults alt to empty", () => {
    expect(asPhotos([{ url: "a.jpg" }, { url: "b.jpg", alt: "B" }])).toEqual([
      { url: "a.jpg", alt: "" },
      { url: "b.jpg", alt: "B" },
    ]);
  });

  it("drops entries without a string url; carries gen only when true", () => {
    expect(
      asPhotos([{ alt: "x" }, { url: 5 }, { url: "c.jpg", gen: true }]),
    ).toEqual([{ url: "c.jpg", alt: "", gen: true }]);
  });
});

describe("firstPhotoUrl", () => {
  it("returns the first url or null", () => {
    expect(firstPhotoUrl([{ url: "a.jpg" }])).toBe("a.jpg");
    expect(firstPhotoUrl([])).toBeNull();
    expect(firstPhotoUrl(undefined)).toBeNull();
  });
});

describe("genPhotoUrls", () => {
  it("prefers flagged photos, else falls back to the cover", () => {
    expect(
      genPhotoUrls([{ url: "a.jpg" }, { url: "b.jpg", gen: true }]),
    ).toEqual(["b.jpg"]);
    expect(genPhotoUrls([{ url: "a.jpg" }, { url: "b.jpg" }])).toEqual([
      "a.jpg",
    ]);
    expect(genPhotoUrls([])).toEqual([]);
  });
});

describe("formatPrice", () => {
  it("formats numbers and numeric strings as whole rubles", () => {
    expect(formatPrice(1500)).toMatch(/1\s?500/);
    expect(formatPrice("2000")).toMatch(/2\s?000/);
  });

  it("coerces non-numeric input to 0", () => {
    expect(formatPrice("not-a-number")).toMatch(/^0/);
  });
});
