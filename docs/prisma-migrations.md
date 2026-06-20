# Prisma migrations (replacing `db push`)

Until now the schema was applied with `prisma db push`: no history, no review
artifact, no rollback. A rename or type change could silently drop a column on a
production database holding real customer appointments, bookings and stock. This
repo now uses **`prisma migrate`** with a committed migration history.

## What's in the repo

- `prisma/migrations/0_init/migration.sql` — a baseline migration that reproduces
  the **entire current production schema**, including the out-of-band
  `availabilityslot_no_overlap` GiST `EXCLUDE` constraint (Prisma can't express
  `EXCLUDE` in `schema.prisma`, so it's appended to the baseline by hand).
- `prisma/migrations/migration_lock.toml` — pins the provider (`postgresql`).
- Scripts in `package.json`:
  - `npm run db:migrate` → `prisma migrate dev` (local: create + apply a migration)
  - `npm run db:migrate:deploy` → `prisma migrate deploy` (CI/prod: apply pending)

`DIRECT_URL` must point at Neon's **non-pooled** endpoint for migrations.

## One-time: baseline the EXISTING production database

The prod DB already has this schema (it was built with `db push`). Tell Prisma the
baseline is already applied so `migrate deploy` won't try to re-create existing
tables:

```bash
# Against PRODUCTION (DIRECT_URL = prod non-pooled endpoint):
npx prisma migrate resolve --applied 0_init
```

Do the same for any other existing environment (staging, a personal dev DB) that
was previously managed with `db push`. A brand-new/empty database needs **no**
resolve — `migrate deploy` will run `0_init` from scratch (constraint included),
so `npm run db:constraints` is no longer required for fresh databases.

## Day-to-day

- Change `schema.prisma`, then `npm run db:migrate` to generate + apply a new
  migration locally. Commit the generated folder under `prisma/migrations/`.
- **Stop using `prisma db push` against shared/production databases.** (`db:push`
  remains in `package.json` only for throwaway local experiments.)
- If you add another hand-written DB object Prisma can't model (like the EXCLUDE
  constraint), put it in its own `migrate dev --create-only` migration and edit
  the SQL, so it stays part of the versioned history.

## Deploy

After the production baseline above is done, switch the deploy to apply pending
migrations before building. Set the Vercel **Build Command** (or `vercel.json`
`buildCommand`) to:

```
prisma migrate deploy && next build
```

Don't make this change before baselining — `migrate deploy` against a
never-baselined DB will fail trying to create tables that already exist.
