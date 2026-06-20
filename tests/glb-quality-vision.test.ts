import { describe, it, expect } from "vitest";
import {
  parseVerdict,
  qualityRejected,
  renderQualityViewsForTest,
  type QualityVerdict,
} from "@/lib/admin/glb-quality-vision";

describe("parseVerdict", () => {
  it("parses a well-formed verdict and clamps the score", () => {
    const v = parseVerdict(
      '{"acceptable":false,"score":150,"issues":["melted","no gem"],"reason":"blob"}',
    );
    expect(v).not.toBeNull();
    expect(v!.ok).toBe(true);
    expect(v!.acceptable).toBe(false);
    expect(v!.score).toBe(100); // clamped from 150
    expect(v!.issues).toEqual(["melted", "no gem"]);
    expect(v!.reason).toBe("blob");
  });

  it("floors negative scores at 0 and tolerates missing fields", () => {
    const v = parseVerdict('{"acceptable":true,"score":-5}');
    expect(v).not.toBeNull();
    expect(v!.score).toBe(0);
    expect(v!.issues).toEqual([]);
    expect(v!.reason).toBe("");
  });

  it("returns null for non-JSON / non-object text", () => {
    expect(parseVerdict("not json")).toBeNull();
    expect(parseVerdict("")).toBeNull();
    expect(parseVerdict("42")).toBeNull();
  });

  it("drops non-string issues and caps the list at 8", () => {
    const issues = Array.from({ length: 12 }, (_, i) => `i${i}`);
    const v = parseVerdict(
      JSON.stringify({ acceptable: true, score: 90, issues: [...issues, 5, null] }),
    );
    expect(v!.issues).toHaveLength(8);
    expect(v!.issues.every((s) => typeof s === "string")).toBe(true);
  });
});

describe("qualityRejected", () => {
  const base: QualityVerdict = {
    ok: true,
    acceptable: false,
    score: 20,
    issues: [],
    reason: "",
    note: "",
  };

  it("rejects only a confident low-score not-acceptable verdict", () => {
    expect(qualityRejected({ ...base, acceptable: false, score: 20 })).toBe(true);
  });

  it("keeps borderline meshes (score at/above the reject threshold)", () => {
    expect(qualityRejected({ ...base, acceptable: false, score: 60 })).toBe(false);
  });

  it("keeps acceptable meshes regardless of score", () => {
    expect(qualityRejected({ ...base, acceptable: true, score: 10 })).toBe(false);
  });

  it("never blocks when the judge didn't return a usable verdict", () => {
    expect(qualityRejected({ ...base, ok: false, score: 0 })).toBe(false);
    expect(qualityRejected(undefined)).toBe(false);
  });
});

describe("renderQualityViewsForTest", () => {
  it("renders 4 PNG views from a vertex cloud", async () => {
    // A crude barbell: a thin run of points along Z with a fat lobe at each end.
    const verts: number[][] = [];
    for (let i = 0; i < 40; i++) {
      const z = -1 + (2 * i) / 39;
      const r = Math.abs(z) > 0.85 ? 0.25 : 0.04; // fat ends, thin middle
      verts.push([r * Math.cos(i), r * Math.sin(i), z]);
    }
    const views = await renderQualityViewsForTest(verts);
    expect(views).toHaveLength(4);
    // Each is a PNG (magic bytes 89 50 4E 47).
    for (const buf of views) {
      expect(buf.length).toBeGreaterThan(8);
      expect(Array.from(buf.subarray(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);
    }
  });
});
