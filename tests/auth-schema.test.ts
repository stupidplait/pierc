import { describe, it, expect } from "vitest";
import {
  signInSchema,
  signUpSchema,
  validateAuthField,
} from "@/lib/auth/auth-schema";

// Shared trust boundary for the public sign-in / sign-up forms AND the
// runLogin / signUpAction server actions. Covers normalization (trim +
// lowercase), the "required-before-invalid" message ordering the form relies
// on, and the per-field helper that drives client-side validation.

describe("signInSchema", () => {
  it("normalizes email (trim + lowercase)", () => {
    const r = signInSchema.safeParse({ email: "  Foo@Bar.COM ", password: "x" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe("foo@bar.com");
  });

  it("rejects an empty email / password", () => {
    expect(signInSchema.safeParse({ email: "", password: "x" }).success).toBe(false);
    expect(signInSchema.safeParse({ email: "a@b.co", password: "" }).success).toBe(
      false,
    );
  });

  it("rejects a malformed email", () => {
    expect(signInSchema.safeParse({ email: "nope", password: "x" }).success).toBe(
      false,
    );
  });

  it("does not impose a length rule on the sign-in password", () => {
    // A single char is enough to *submit*; the real check is in authorize().
    expect(signInSchema.safeParse({ email: "a@b.co", password: "x" }).success).toBe(
      true,
    );
  });
});

describe("signUpSchema", () => {
  const base = {
    name: "Анна",
    email: "anna@example.com",
    password: "12345678",
    phone: "",
  };

  it("accepts a complete sign-up", () => {
    expect(signUpSchema.safeParse(base).success).toBe(true);
  });

  it("treats phone as optional", () => {
    const { phone: _omit, ...noPhone } = base;
    void _omit;
    expect(signUpSchema.safeParse(noPhone).success).toBe(true);
    expect(signUpSchema.safeParse({ ...base, phone: "" }).success).toBe(true);
  });

  it("rejects a blank name", () => {
    expect(signUpSchema.safeParse({ ...base, name: "   " }).success).toBe(false);
  });

  it("rejects a password shorter than 8", () => {
    expect(signUpSchema.safeParse({ ...base, password: "abc" }).success).toBe(false);
  });
});

describe("validateAuthField", () => {
  it("reports required before invalid for an empty email", () => {
    expect(validateAuthField("signIn", "email", "")).toBe(
      "Укажите email.",
    );
    expect(validateAuthField("signIn", "email", "foo")).toBe(
      "Укажите корректный email.",
    );
  });

  it("returns null for a valid value", () => {
    expect(validateAuthField("signIn", "email", "a@b.co")).toBeNull();
    expect(validateAuthField("signUp", "password", "12345678")).toBeNull();
  });

  it("returns null for fields absent in the mode", () => {
    expect(validateAuthField("signIn", "name", "anything")).toBeNull();
    expect(validateAuthField("signIn", "phone", "")).toBeNull();
  });

  it("treats sign-up phone (optional) as always valid when empty", () => {
    expect(validateAuthField("signUp", "phone", "")).toBeNull();
  });
});
