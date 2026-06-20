import { describe, it, expect } from "vitest";
import { safeInternalPath } from "@/lib/safe-redirect";

describe("safeInternalPath", () => {
  it("keeps normal internal paths (incl. query strings)", () => {
    expect(safeInternalPath("/account", "/fallback")).toBe("/account");
    expect(safeInternalPath("/catalog/123?x=1", "/fallback")).toBe(
      "/catalog/123?x=1",
    );
  });

  it("falls back for empty / missing values", () => {
    expect(safeInternalPath(null, "/account")).toBe("/account");
    expect(safeInternalPath(undefined, "/account")).toBe("/account");
    expect(safeInternalPath("", "/account")).toBe("/account");
  });

  it("rejects external and protocol-relative / backslash open-redirects", () => {
    expect(safeInternalPath("https://evil.com", "/account")).toBe("/account");
    expect(safeInternalPath("//evil.com", "/account")).toBe("/account");
    expect(safeInternalPath("/\\evil.com", "/account")).toBe("/account");
    expect(safeInternalPath("relative/path", "/account")).toBe("/account");
  });

  it("rejects control characters browsers may normalize away", () => {
    expect(safeInternalPath("/foo\nbar", "/account")).toBe("/account");
    expect(safeInternalPath("/foo\tbar", "/account")).toBe("/account");
  });
});
