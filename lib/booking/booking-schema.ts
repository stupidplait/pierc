import { z } from "zod";

// Extracted from the createBooking server action so this validation — the trust
// boundary for every public booking POST — is unit-testable. ("use server" files
// may only export async functions, so the schema cannot be exported from there.)
export const bookingSchema = z
  .object({
    purpose: z.enum(["appointment", "jewelry", "both"]),
    items: z.string().optional(), // "id1,id2,id3"
    serviceId: z.string().optional(),
    slotId: z.string().optional(),
    name: z.string().trim().min(1, "Укажите имя"),
    email: z.string().trim().email("Укажите корректный email"),
    phone: z.string().trim().min(3, "Укажите телефон"),
    notes: z.string().trim().optional(),
  })
  .superRefine((v, ctx) => {
    const itemIds: string[] = [];
    for (const s of (v.items ?? "").split(",")) {
      const t = s.trim();
      if (t) itemIds.push(t);
    }

    if ((v.purpose === "appointment" || v.purpose === "both") && !v.slotId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Выберите время",
        path: ["slotId"],
      });
    }
    if (
      (v.purpose === "jewelry" || v.purpose === "both") &&
      itemIds.length === 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Выберите хотя бы одно украшение",
        path: ["items"],
      });
    }
  });

export type BookingInput = z.infer<typeof bookingSchema>;
