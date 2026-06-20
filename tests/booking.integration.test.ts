import { describe, it } from "vitest";

// Integration tests for the booking / stock / cancel invariants (audit
// testing-1 & testing-2). These require a REAL Postgres with the schema applied
// (Testcontainers or a disposable Neon branch). They are written as `it.todo`
// placeholders so they document the exact cases to cover and never falsely pass;
// implement them against a test DB and a TEST_DATABASE_URL, then run:
//
//   TEST_DATABASE_URL=postgres://... npx vitest run tests/booking.integration.test.ts
//
// Drive them through lib/booking/cancel.ts and the atomic `updateMany` decrement
// in lib/booking/actions.ts. See docs/AUDIT-HARDENING.md.

describe("booking / stock invariants (integration — needs a test DB)", () => {
  it.todo(
    "decrements stock atomically: two concurrent buyers can't both win the last unit",
  );
  it.todo("cancel restores exactly the stock it took (round-trip)");
  it.todo("cancel is idempotent on CANCELLED / COMPLETED / NO_SHOW");
  it.todo(
    "a public booking never overwrites a registered (non-guest) user's name/phone",
  );
  it.todo(
    "slot double-booking is rejected (P2002) with the friendly RU message",
  );
  it.todo(
    "overlapping slot insert is rejected by the GiST EXCLUDE constraint (23P01)",
  );
});
