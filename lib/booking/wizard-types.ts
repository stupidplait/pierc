// Client-safe serialized shapes shared by the booking wizard (/book) and the
// catalog booking drawer. Prisma types never cross to the client — server
// components / actions map their rows into these before handing them over.

export interface WizardService {
  id: string;
  name: string;
  description: string | null;
  price: string;
  durationMin: number;
}

export interface WizardJewelry {
  id: string;
  name: string;
  price: string;
  photo: string | null;
  inStock: number;
}

export interface WizardSlot {
  /** ISO strings — formatted on the client via module-level helpers. */
  id: string;
  startsAt: string;
  endsAt: string;
}

/**
 * Signed-in user passed to the booking surfaces to prefill the contact fields.
 * `phone` comes from the User row (not the session token, which only carries
 * name/email) and is null when the customer has none on file yet.
 */
export interface BookingUser {
  name: string;
  email: string;
  phone?: string | null;
}
