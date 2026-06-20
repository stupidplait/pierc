import { describe, it, expect } from "vitest";
import { settingsSchema } from "@/lib/admin/settings-schema";

// Admin settings form — exercises the preprocess (empty→undefined, URL
// normalization) and refine (11-digit phone, numeric chat id) branches.

describe("settingsSchema", () => {
  it("treats empty strings as undefined (every field optional)", () => {
    const r = settingsSchema.safeParse({
      contactEmail: "",
      contactPhone: "",
      contactAddress: "",
      instagramUrl: "",
      telegramUrl: "",
      telegramChatId: "",
      workingHoursHint: "",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.contactEmail).toBeUndefined();
  });

  it("validates email", () => {
    expect(settingsSchema.safeParse({ contactEmail: "bad" }).success).toBe(
      false,
    );
    expect(settingsSchema.safeParse({ contactEmail: "a@b.com" }).success).toBe(
      true,
    );
  });

  it("requires a full 11-digit phone", () => {
    expect(
      settingsSchema.safeParse({ contactPhone: "+7 (999) 000" }).success,
    ).toBe(false);
    expect(
      settingsSchema.safeParse({ contactPhone: "+7 999 000 00 00" }).success,
    ).toBe(true);
  });

  it("normalizes a bare domain to https for URL fields", () => {
    const r = settingsSchema.safeParse({ instagramUrl: "instagram.com/studio" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.instagramUrl).toBe("https://instagram.com/studio");
    }
  });

  it("accepts a numeric telegram chat id and rejects letters", () => {
    expect(settingsSchema.safeParse({ telegramChatId: "-100123" }).success).toBe(
      true,
    );
    expect(settingsSchema.safeParse({ telegramChatId: "abc" }).success).toBe(
      false,
    );
  });
});
