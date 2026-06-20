-- Slot overlap guard — DB-level backstop for the read-then-write check in
-- lib/admin/slot-actions.ts (createSlot / bulkCreateSlots). Two concurrent
-- admins could otherwise both pass the application overlap check and insert
-- intersecting windows; this EXCLUDE constraint makes the database reject any
-- overlap regardless of concurrency.
--
-- Prisma cannot express EXCLUDE constraints in schema.prisma, so this is applied
-- out of band:  npm run db:constraints   (prisma db execute against DATABASE_URL)
--
-- NOTE: Prisma maps `DateTime` to `timestamp(3)` WITHOUT time zone, so we use
-- tsrange (not tstzrange). The default '[)' bound matches the half-open overlap
-- semantics used in the application (startsAt < end AND endsAt > start).
--
-- Idempotent: drops the constraint first so re-running is safe. If existing rows
-- already overlap, the ADD will fail — clean those up first.

ALTER TABLE "AvailabilitySlot"
  DROP CONSTRAINT IF EXISTS "availabilityslot_no_overlap";

ALTER TABLE "AvailabilitySlot"
  ADD CONSTRAINT "availabilityslot_no_overlap"
  EXCLUDE USING gist (tsrange("startsAt", "endsAt") WITH &&);
