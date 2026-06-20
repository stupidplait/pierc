import { describe, it, expect } from "vitest";
import { isSafeAssetUrl, assertSafeAssetUrl } from "@/lib/security/safe-fetch";

// SSRF guard for server-side asset fetches (GLB rehost + blob proxy).

describe("isSafeAssetUrl", () => {
  it("allows public https asset hosts", () => {
    expect(
      isSafeAssetUrl("https://abc.public.blob.vercel-storage.com/x.glb"),
    ).toBe(true);
    expect(isSafeAssetUrl("https://replicate.delivery/pbxt/x.glb")).toBe(true);
    expect(isSafeAssetUrl("https://raw.githubusercontent.com/a/b.glb")).toBe(
      true,
    );
  });

  it("rejects non-https schemes", () => {
    expect(isSafeAssetUrl("http://example.com/x.glb")).toBe(false);
    expect(isSafeAssetUrl("file:///etc/passwd")).toBe(false);
    expect(isSafeAssetUrl("ftp://example.com/x")).toBe(false);
  });

  it("rejects loopback / private / link-local hosts", () => {
    expect(isSafeAssetUrl("https://localhost/x")).toBe(false);
    expect(isSafeAssetUrl("https://127.0.0.1/x")).toBe(false);
    expect(isSafeAssetUrl("https://10.0.0.5/x")).toBe(false);
    expect(isSafeAssetUrl("https://192.168.1.1/x")).toBe(false);
    expect(isSafeAssetUrl("https://172.16.4.4/x")).toBe(false);
    expect(isSafeAssetUrl("https://169.254.169.254/latest/meta-data")).toBe(
      false,
    );
    expect(isSafeAssetUrl("https://[::1]/x")).toBe(false);
  });

  it("rejects embedded credentials and unparseable input", () => {
    expect(isSafeAssetUrl("https://user:pass@evil.com/x")).toBe(false);
    expect(isSafeAssetUrl("not a url")).toBe(false);
    expect(isSafeAssetUrl("")).toBe(false);
  });

  it("does not misclassify public hosts that merely start like a private range", () => {
    expect(isSafeAssetUrl("https://fc-barcelona.com/x.glb")).toBe(true);
    expect(isSafeAssetUrl("https://10cabinets.com/x.glb")).toBe(true);
  });

  it("assertSafeAssetUrl throws on unsafe and returns the url on safe", () => {
    expect(() => assertSafeAssetUrl("https://169.254.169.254/")).toThrow();
    expect(
      assertSafeAssetUrl("https://x.blob.vercel-storage.com/a.glb"),
    ).toContain("vercel-storage");
  });
});
