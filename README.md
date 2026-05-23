# 3D Piercing Studio

> Working title

A Next.js web app for a solo piercer's studio with a 3D virtual jewelry try-on, a no-payment booking system for jewelry and appointments, an admin panel, and an automated photo→3D-model pipeline. UI is in Russian. A React Native mobile app is planned for Phase 2.

## Tech stack

Next.js 16 (App Router) + React 19 + TypeScript + Tailwind v4 + Prisma + Neon Postgres + Vercel Blob + Auth.js + three / @react-three/fiber / @react-three/drei + Resend + Telegram Bot + Tripo3D, deployed on Vercel.

## Specification

See [`docs/README.md`](./docs/README.md) for the full specification, architecture, data model, flows, and the 15-task implementation roadmap.

## Quick start

Requires Node.js 20+ and a Neon Postgres database (free tier is fine).

```bash
# 1. Install dependencies (also runs `prisma generate`)
npm install

# 2. Configure environment
#    Replace the placeholder .env that ships with the repo with real values.
#    .env is read by both Prisma CLI and Next.js. It is gitignored.
copy .env.example .env            # Windows
cp   .env.example .env            # macOS / Linux
# Open .env and fill in DATABASE_URL + DIRECT_URL from Neon at minimum.

# 3. Push the schema to Neon and run the seed
npm run db:push
npm run db:seed

# 4. Start the dev server
npm run dev
```

Open <http://localhost:3000> — you should see the public site shell. `/api/health` returns `{ ok: true, db: true }` once Neon credentials are in place. Log in to `/admin/login` with `ADMIN_SEED_EMAIL` / `ADMIN_SEED_PASSWORD` from `.env` to manage content and jewelry.

## Available scripts

| Command            | Description                                      |
| ------------------ | ------------------------------------------------ |
| `npm run dev`      | Start the Next.js dev server                     |
| `npm run build`    | Production build (TypeScript + static pages)     |
| `npm run start`    | Run the built app                                |
| `npm run lint`     | ESLint                                           |
| `npm run db:push`  | Push the Prisma schema to the database           |
| `npm run db:seed`  | Run the seed (admin user + categories + anchors + jewelry) |
| `npm run db:studio`| Open Prisma Studio against the configured DB     |
| `npm run jewelry:upload`  | Upload `art/jewelry-out/*.glb` to Vercel Blob (hash-based dedup) |
| `npm run jewelry:rebuild` | `jewelry:upload` then `db:seed` — convenience wrapper after a Blender re-export |

## Project layout

```
app/                Next.js App Router pages + route handlers
  (public)/         Public site (catalog, about, services, …)
  admin/            Admin panel (auth-walled)
  api/              Route handlers (health, auth, …)
components/
  catalog/          3D showroom (Mannequin, AnchorDots, Showroom, …)
  admin/            Admin form atoms + per-resource forms
  public/           Header, Footer, mobile menu
  ui/               Button, Card, Section, PageHeader
docs/               Full specification (start at docs/README.md)
lib/
  auth.ts           NextAuth instance
  prisma.ts         Singleton Prisma client
  i18n/ru.ts        Single source of truth for all RU strings
  catalog/          Showroom types + URL state helpers
  jewelry/          Price formatting, photo coercion
  admin/            Server actions (CMS + jewelry)
prisma/
  schema.prisma     Models for auth, anchors, catalog, CMS, settings
  seed.ts           Idempotent seed: admin, categories, anchors
public/             Static assets
```

## Status

All 15 tasks complete. Highlights:

- ✅ Project scaffold + DB wiring + Tailwind v4 theme + RU theme tokens
- ✅ Public site shell with cleaned-up nav (`Главная · О студии · Услуги · Каталог · Галерея · FAQ` + `Войти / Регистрация / Записаться`)
- ✅ Admin auth (NextAuth v5 Credentials) + protected admin shell
- ✅ Site-content CMS — About, Services, FAQ, Gallery, Settings, with Vercel Blob photo uploads
- ✅ **3D showroom catalog** — interactive try-on at `/catalog` with the real body GLB, 20+ anchor dots, camera tweens, multi-piece equip with soft cap of 6, URL-encoded shareable looks (`?anchor=…&eq=…`), and an automatic 2D fallback when WebGL2 isn't available
- ✅ **Auto-3D pipeline** — Tripo3D image-to-model wired end-to-end with fallback chain, blob re-hosting, admin review/approve/reject UI, dry-run mode for credit-free testing
- ✅ **Public auth** — sign-in / sign-up / `/account` with guest-upgrade by email
- ✅ **Slot management** — bulk-create monthly schedules in one click, plus single-create for one-offs
- ✅ **Booking flow** — 4-step stepper at `/book`, atomic transaction, multi-piece + appointment combined; `/book/success` summary
- ✅ **Email + Telegram notifications** — Resend templates + Bot API; admin status changes can re-trigger; opt-in checkbox
- ✅ **Storytelling landing** — `/` walks through hero → choose → fit → book with shared `?eq=` URL state across chapters
- ✅ **Admin dashboards** — `/admin` overview cards; `/admin/bookings` and `/admin/appointments` with status transitions + cascade COMPLETED→FULFILLED + inline stock +/-1 on jewelry list
- ✅ **Deploy-ready** — `/api/cron/poll-jobs` for automated Tripo polling, automatic WebGL2 capability check, `frameloop="demand"` on the showroom (idle 0% GPU when settled)

## Deployment

The project is set up for Vercel + Neon + Vercel Blob + Resend + Telegram. Step-by-step deploy:

### 1. External services

| Service | What you need |
|---|---|
| **Neon** | Production database. Create a project, grab pooled `DATABASE_URL` + direct `DIRECT_URL` (for migrations). Free tier OK. |
| **Vercel** | Hosting. Connect the GitHub repo. Add env vars (next section). Vercel Blob is auto-provisioned when first used. |
| **Resend** | Transactional emails. Sign up, generate API key. For production: verify a domain (DKIM + SPF DNS records); for dev: use `onboarding@resend.dev`. |
| **Telegram bot** | Admin alerts. Talk to @BotFather → `/newbot` → save the token. Talk to your bot once, then visit `https://api.telegram.org/bot<TOKEN>/getUpdates` and grab the numeric `chat.id`. |
| **Tripo3D** | Auto-3D generation (paid, pay-per-task). Sign up at platform.tripo3d.ai, save API key. Optional: omit it and only use manual `.glb` uploads. |

### 2. Environment variables

Set these in **Vercel → Project Settings → Environment Variables** for the Production environment (and Preview if you want):

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | ✅ | Neon pooled connection (used at runtime) |
| `DIRECT_URL` | ✅ | Neon direct connection (used by Prisma migrations) |
| `BLOB_READ_WRITE_TOKEN` | ✅ | Vercel Blob auto-injects this when the integration is enabled |
| `AUTH_SECRET` | ✅ | `openssl rand -base64 32` or `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `AUTH_TRUST_HOST` | — | Vercel sets the host correctly; leave unset on Vercel. Required `"true"` only on non-Vercel hosts. |
| `RESEND_API_KEY` | optional | Without this, emails skip silently |
| `RESEND_FROM_EMAIL` | optional | e.g. `Pierc Studio <studio@yourdomain.com>` |
| `TELEGRAM_BOT_TOKEN` | optional | Without this, Telegram alerts skip silently |
| `TRIPO3D_API_KEY` | optional | Without this, only manual `.glb` uploads work |
| `APP_URL` | optional | Production URL, e.g. `https://piercing.studio` — used in emails for admin deep-links |
| `CRON_SECRET` | ✅ for cron | Long random string. Vercel Cron sends this as `Authorization: Bearer ${CRON_SECRET}`. Keep `/api/cron/poll-jobs` open in dev by leaving unset locally. |
| `ADMIN_SEED_EMAIL` / `ADMIN_SEED_PASSWORD` | dev-only | Used by `prisma db seed` to create the initial admin row. Delete from production after the first deploy. |

### 3. First deploy

1. Push to GitHub, Vercel deploys automatically.
2. After the first build, run from your local machine pointed at the production Neon DB:
   ```bash
   DATABASE_URL=<prod-pooled> DIRECT_URL=<prod-direct> npm run db:push
   DATABASE_URL=<prod-pooled> DIRECT_URL=<prod-direct> npm run db:seed
   ```
   Or use Vercel CLI to run them in the deployed environment.
3. Visit `<deploy-url>/admin/login` and sign in with the seed credentials.
4. Open `/admin/settings` and fill in `contactEmail`, `telegramChatId`, working hours, social URLs.
5. Click **Тестовое уведомление** to verify Email + Telegram both report `✓`.
6. Add real services / FAQ / gallery via `/admin/content`.
7. Bulk-create slots via `/admin/slots`.

### 4. Vercel Cron

`vercel.json` ships configured to hit `/api/cron/poll-jobs` every 2 minutes — this is what drives the auto-3D pipeline (poll Tripo, re-host the GLB, surface for admin review). You don't need to do anything beyond setting `CRON_SECRET`. Verify in the Vercel dashboard → your project → Crons that the schedule is active.

### 5. Smoke checklist

- [ ] `<deploy-url>/api/health` returns `{ ok: true, db: true }`
- [ ] Public `/` snap-scrolls through three chapters
- [ ] `/catalog` shows the 3D showroom; click an anchor, equip a piece, see camera tween
- [ ] Browser without WebGL2 sees the auto-fallback grid (test with Firefox `webgl2.disabled`)
- [ ] `/admin/login` works with the seeded credentials
- [ ] **Тестовое уведомление** under `/admin/settings` reports per-leg success
- [ ] Make a real booking — user gets a confirmation email, admin gets email + Telegram, `/admin/bookings` shows the new row
- [ ] On a phone: bottom-sheet sidebar in showroom, sticky header survives scroll, all forms have ≥44px touch targets

## Body model pipeline

The 3D try-on body lives at `public/models/body/body.glb` (~340 KB, Draco-compressed, Y-up). It's a CC3 / Character Creator 3 base baked in A-pose with a flat `#cfcfcf` mannequin material on Body / Eye / Teeth / Underwear and the original textured `Hair_30629` (alpha-CLIP, ≤1024² maps). 29 named anchor empties (`anchor:left-ear-lobe`, `anchor:septum`, …) are embedded as glTF nodes so three.js can read transforms directly; the same anchors are seeded into the DB from `prisma/seed-data/anchors.json`.

The pipeline scripts live under `scripts/blender/` and run inside a **live Blender session** via the [`blender-mcp`](https://github.com/ahujasid/blender-mcp) MCP server (configured in `.kiro/settings/mcp.json`). The source `.blend` is kept locally under `art/source/` (gitignored). To re-export:

1. Open `art/source/body.blend` in Blender; ensure the BlenderMCP addon shows "Connected".
2. Restart kiro-cli so it loads the workspace MCP server.
3. Run the scripts via `execute_blender_code` — `01_inspect.py`, then iterate on placement / pose / materials, then re-export `body.glb` and write `prisma/seed-data/anchors.json`.

See [`docs/07-3d-fitting.md`](./docs/07-3d-fitting.md) for the body-model spec (anchor `place` enum, `side` field, mannequin material) and [`docs/04-data-model.md`](./docs/04-data-model.md) for the Prisma schema.

## Parametric jewelry pipeline

Real `.glb` jewelry models are produced by a parametric Blender pipeline that mirrors the body-model flow. Each piece is described by a single entry in `prisma/seed-data/jewelry.json` (slug, shape, params, material, anchor list, price, stock); `scripts/blender/jewelry/build_all.py` reads that manifest and emits one Draco-compressed `.glb` per piece into `art/jewelry-out/<slug>.glb` (gitignored). `npm run jewelry:upload` pushes those files to Vercel Blob with hash-based dedup, recording `{ slug → blobUrl }` in `prisma/seed-data/jewelry-uploads.json` (committed). `npm run db:seed` joins the manifest with the upload map and upserts `Jewelry` rows.

Six shape scripts cover ~22 catalog pieces across all 8 categories: `seamless_hoop`, `curved_barbell`, `straight_barbell`, `horseshoe`, `labret_stud`, `nose_stud_l`. Materials include polished titanium, 14k/18k gold, rose gold, and PVD-coated black; gem variants render with transmissive/emissive PBR (clear, pink, blue, opal-white).

See [`docs/14-jewelry-pipeline.md`](./docs/14-jewelry-pipeline.md) for the full manifest schema, shape reference, re-export workflow, and troubleshooting guide.

## License

Private project.
