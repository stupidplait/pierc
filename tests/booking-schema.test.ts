import { describe, it, expect } from "vitest";
import { bookingSchema } from "@/lib/booking/booking-schema";

// The trust boundary for every public booking POST. Covers the superRefine
// branches the form relies on (slot required for appointments, ≥1 item for
// jewelry, whitespace-only items treated as empty) plus the field validators.

const base = {
  purpose: "both" as const,
  items: "j1,j2",
  serviceId: "s1",
  slotId: "slot1",
  name: "Анна",
  email: "anna@example.com",
  phone: "+7 999 000-00-00",
  notes: "",
};

describe("bookingSchema", () => {
  it("accepts a complete 'both' booking", () => {
    expect(bookingSchema.safeParse(base).success).toBe(true);
  });

  it("requires a slot for appointment / both", () => {
    const r = bookingSchema.safeParse({
      ...base,
      purpose: "appointment",
      slotId: "",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path[0] === "slotId")).toBe(true);
    }
  });

  it("does not require a slot for a jewelry-only booking", () => {
    const r = bookingSchema.safeParse({
      purpose: "jewelry",
      items: "j1",
      name: "A",
      email: "a@b.com",
      phone: "+700",
    });
    expect(r.success).toBe(true);
  });

  it("requires at least one item for jewelry / both", () => {
    const r = bookingSchema.safeParse({ ...base, purpose: "jewelry", items: "" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path[0] === "items")).toBe(true);
    }
  });

  it("treats whitespace-only items as empty", () => {
    const r = bookingSchema.safeParse({
      ...base,
      purpose: "jewelry",
      items: " , ,  ",
    });
    expect(r.success).toBe(false);
  });

  it("rejects an invalid email and a blank name", () => {
    expect(bookingSchema.safeParse({ ...base, email: "nope" }).success).toBe(
      false,
    );
    expect(bookingSchema.safeParse({ ...base, name: "   " }).success).toBe(
      false,
    );
  });

  it("rejects a too-short phone", () => {
    expect(bookingSchema.safeParse({ ...base, phone: "1" }).success).toBe(false);
  });
});
