# 12 — Implementation Roadmap (15 Tasks)

Each task is incremental, ends with a working demoable increment, and builds on the previous tasks. No orphaned code.

> **Status legend:** ✅ done · 🟡 partial · ⏸ paused · ⬜ not started.
>
> **Implementation notes** at the end of each task call out where the shipped code diverged from the original spec.

---

## Task 1: Project scaffolding, database, and dev environment ✅

**Objective:** stand up the empty project skeleton with database connectivity working end-to-end so every later task has a foundation to build on.

**Implementation guidance:**
- Initialize Next.js (App Router) + TypeScript + Tailwind CSS + ESLint.
- Add Prisma; configure Neon connection (`DATABASE_URL`, `DIRECT_URL`).
- Create base `prisma/schema.prisma` with `User`, `AdminUser`, and `Settings` (minimal subset); run first migration.
- Add `lib/prisma.ts` singleton, placeholder `lib/i18n/ru.ts`, base Tailwind theme aligned to a dark / jewelry-store vibe.
- Create `.env.example` documenting every env var listed in [`03-architecture.md`](./03-architecture.md).
- Add a `/api/health` route returning `{ ok, db }`.

**Demo:** `npm run dev` shows a Russian `Скоро открытие` placeholder. `npx prisma db push` succeeds against Neon. `/api/health` returns `{ ok: true, db: true }`.

**Implementation notes:** Next.js 16 + React 19 + Tailwind v4 (with `@theme` tokens). Prisma pinned to 6.x to keep the schema-with-`url` pattern. Inter + Onest fonts via `next/font`. Light + dark theme tokens with primary `#fe017e`.

---

## Task 2: Public site shell, RU layout, and routing ✅

**Objective:** create every public route with a polished shared layout so we can navigate the site even before features land.

**Implementation guidance:**
- Build `Header` (logo + nav: `Главная`, `О студии`, `Услуги`, `Каталог`, `Галерея`, `FAQ`; right-side actions: `Войти`, `Регистрация`, `Записаться`) and `Footer` (contact placeholders, social links).
- Create empty pages for every public route (`/about`, `/services`, `/catalog`, `/catalog/[id]`, `/gallery`, `/book`, `/book/success`, `/faq`, `/account`, `/auth/sign-in`, `/auth/sign-up`) with RU placeholder copy.
- Mobile nav: hamburger menu that slides in.
- Add typography scale and base UI primitives (`Button`, `Card`, `Section`, `PageHeader`) in Tailwind.

**Demo:** Navigate every public route on desktop and a phone; mobile menu opens/closes; layout looks polished even with placeholder content.

**Implementation notes:** Originally the nav had 8 entries (`Главная · О нас · Услуги · Каталог · Галерея · Запись · FAQ · Контакты`); the cleanup pass collapsed it to 5 nav links + 3 right-side actions and merged `/contact` into `/about#contact` (308 redirect via `next.config.ts`). `Запись` was removed since `Записаться` is the primary CTA button.

---

## Task 3: Admin authentication and protected admin shell ✅

**Objective:** the studio owner can log in and reach a protected admin area.

**Implementation guidance:**
- Install Auth.js (NextAuth v5) with a Credentials provider for `AdminUser`.
- Build `/admin/login` page and route protection middleware for `/admin/*`.
- Build `AdminLayout` with the sidebar specified in [`09-admin-panel.md`](./09-admin-panel.md): `Главная`, `Каталог`, `Слоты`, `Бронирования`, `Записи`, `Контент`, `Настройки`, `Выход`.
- Create `prisma/seed.ts` to seed one admin user with bcrypt-hashed password (read from env `ADMIN_SEED_EMAIL` / `ADMIN_SEED_PASSWORD`).

**Demo:** Run seed → log in at `/admin/login` → land on protected dashboard → log out works → unauthenticated visitor is redirected to login.

**Implementation notes:** Used the split edge/node config pattern (`auth.config.ts` for the edge-safe authorized callback, `lib/auth.ts` for the Credentials provider with bcrypt). The Next.js 16 rename of `middleware.ts` → `proxy.ts` is reflected in the repo. Defense-in-depth: the protected admin layout independently calls `auth()` and redirects.

---

## Task 4: Site content CMS (About, Services, FAQ, Gallery, Settings) ✅

**Objective:** every "soft" content piece on the public site is editable from the admin panel without code changes.

**Implementation guidance:**
- Add `SiteContent`, `Service`, `FAQItem`, `GalleryPhoto`, `Settings` models; migrate.
- Build admin UIs for each: list / create / edit / delete / reorder / toggle published.
- Implement Vercel Blob uploads for gallery photos.
- Render content on public `/about` (with a `#contact` section sourced from `Settings`), `/services`, `/faq`, `/gallery` (server-side reads).
- Settings form (contact info, working-hours hint, Telegram chat id, social links). Header / footer read from `Settings`.

**Demo:** Admin edits "О студии" text, adds three services with prices, adds four FAQ items, uploads five gallery photos, updates the contact phone — all changes appear immediately on the public pages.

**Implementation notes:** `/contact` was originally a separate route with its own page; the about/contact merge collapsed it into a `#contact` section on `/about`, eliminating a redundant page. Footer became an async server component reading the live `Settings` singleton.

---

## Task 5: Jewelry catalog as 3D showroom (folds in original Tasks 6 + 7) ✅

**Objective:** admin can add jewelry; public visitors can browse it inside an interactive 3D showroom that doubles as the multi-piece try-on.

> **Scope expansion:** the original Task 5 was "catalog basics, no 3D yet". During implementation we restructured the catalog into a 3D showroom (anchors-as-dots, click-to-equip, soft cap 6) in one pass instead of three. The original Tasks 6 and 7 are absorbed here; downstream tasks (8 = auto-3D, 11 = bookings, 13 = storytelling) reuse the showroom rather than building a separate `/try-on` surface.

**Implementation guidance:**
- Add `Jewelry`, `JewelryCategory`, `AnchorPoint` models + `JewelryStatus` and `BodyRegion` enums; migrate.
- Seed 8 categories and all 20 anchor points with positions + first-camera-preset tuned for the procedural placeholder mannequin (Y-up, +Z forward, ~1.65m tall figure).
- Admin: jewelry list (filters by category/status/featured + search) + create/edit form (name, description, category, material, gauge, size, color, stones, price, in-stock count, photos via Blob upload, supported anchors multi-select, featured toggle, manual `glbUrl` field for now); delete with confirmation cascading photo cleanup.
- Public `/catalog` is the **3D showroom**: procedural mannequin + clickable anchor dots + sidebar with anchor combobox / tray / filtered jewelry list. Camera tweens to the active anchor's preset; one piece per anchor; soft cap of 6.
- `/catalog?view=grid` renders a 2D card-grid fallback (`<CatalogGridFallback>`) for when WebGL is unavailable or the user prefers the simple list.
- Public `/catalog/[id]` is now a description page (photo gallery + attributes + anchor tags) with a `Примерить` deep-link into the showroom (`/catalog?anchor=<slug>&eq=<slug>:<id>`); `Забронировать` remains disabled until Task 11.
- Stack: `three`, `@react-three/fiber`, `@react-three/drei`. The 3D scene is dynamically imported with `ssr:false`.

**URL state contract for the showroom:**
- `?anchor=<slug>` — focused anchor (drives camera + sidebar filter).
- `?eq=<slug>:<jewelryId>,<slug>:<jewelryId>` — equipped pieces (cap 6).
- `?view=grid` — fallback list.

**Demo:** Admin adds three jewelry items with photos and metadata; on `/catalog` the visitor sees the mannequin with anchor dots, clicks an ear lobe, the camera zooms to that ear, the sidebar shows compatible jewelry, the visitor clicks `Примерить` and a small ring appears on the model; the URL updates so the look is shareable.

**Implementation notes:**
- The body is a procedural humanoid built from primitives (sphere + cylinders) — placeholder for a real GLB. Anchor positions in the seed are tuned for this geometry; they'll be re-tuned when a real body model lands.
- No `OrbitControls` in v1 — the camera is curated and snaps to anchor presets. Free-rotate could be added later as an opt-in toggle if user testing wants it.
- Soft cap value lives in `lib/catalog/types.ts` (`SOFT_CAP = 6`), not in DB config.
- Photos column is `Json` (not a separate table) shaped as `[{url, alt}]` with `"[]"` default; coerced via `asPhotos()` in `lib/jewelry/format.ts`.

---

## Task 6: ~~3D viewer foundation — body regions, anchors, preset cameras~~ — merged into Task 5 ✅

The original Task 6 plan (separate body GLBs per region, region selector tabs, locked preset cameras) was folded into Task 5. The current implementation deviates in two ways:
- **One mannequin, not three regional GLBs.** A procedural full-body placeholder covers HEAD, TORSO, and OTHER anchors in a single scene. When we replace the placeholder with a real body model, the data shape (`AnchorPoint.position` + `cameraPresets`) is unchanged.
- **No region tabs.** With one mannequin and a combobox listing all 20 anchors grouped by region (`<optgroup>`), region tabs add a click without adding clarity. They can be reintroduced later if the anchor count grows enough that the combobox feels heavy.

What's still pending from the original Task 6 spec:
- Real body GLB (with Draco compression and KTX2 textures) replacing the procedural mannequin.
- Optional limited free-orbit (±15° azimuth/polar) around the active preset — currently the camera is pure preset-snap.
- Automated WebGL2 capability check (currently the `?view=grid` fallback is opt-in).

These are tracked as polish items for Task 15 (or earlier, when a real GLB asset is sourced).

---

## Task 7: ~~Multi-piece jewelry 3D fitting~~ — merged into Task 5 ✅

The original Task 7 plan (multi-piece try-on with tray UI, soft cap of 6, URL-encoded look state) is implemented in Task 5's showroom:

- **One piece per anchor** — equipping on an occupied anchor replaces the previous piece.
- **Soft cap of 6** total equipped pieces — additional `Примерить` clicks are disabled with a tooltip.
- **Tray UI** — sidebar section showing equipped pieces with per-item remove and a `X/6` counter; on mobile it stacks below the 3D viewport rather than appearing as a bottom-sheet chip.
- **URL state** — `?eq=<slug>:<id>,<slug>:<id>` (deep-linkable, browser back/forward works).

Remaining polish from the original spec, tracked for later:
- Per-jewelry GLB rendering (currently every equipped piece renders as the same small pink torus placeholder; real GLBs land with Task 8).
- Inline picker `Добавить ещё` button — currently the picker is the always-visible filtered list; a separate "add more" button isn't needed.
- Per-anchor reassignment UI — currently you remove + re-add; a one-click reassign could be a polish item.

---

## Task 8: Auto-3D generation pipeline 🟡

**Objective:** admin uploads photos and the system generates a `.glb` automatically; admin reviews and publishes.

**Implementation guidance:**
- Implement `lib/three-gen/index.ts` provider abstraction with `tripo3d.ts` (primary), `meshy.ts` (alt), `manual.ts` (no-op).
- Add `GenerationJob` model; migrate.
- Admin jewelry edit: `Сгенерировать 3D` button uploads photos to Blob, creates `GenerationJob(QUEUED)`, calls provider, stores `providerJobId`; status moves to `PROCESSING`.
- `/api/cron/poll-jobs` Vercel Cron (every 1 min) polls in-flight jobs; on success, downloads the resulting `.glb` to Blob and sets `Jewelry.status = PENDING_REVIEW`.
- Admin jewelry detail: shows job status; on `PENDING_REVIEW`, embed mini 3D preview with `Утвердить` / `Перегенерировать` / `Загрузить вручную` actions; approve sets `status = PUBLISHED`.
- Manual `.glb` upload always available as a fallback (skips the pipeline, sets `PUBLISHED` directly).
- Once jewelry has a real `glbUrl`, the showroom's `<EquippedPieces>` switches from the placeholder torus to the loaded GLB.

**Demo:** Admin creates a new jewelry, uploads two photos, clicks `Сгенерировать` → status updates `QUEUED → PROCESSING → PENDING_REVIEW` → admin previews the model → approves → it appears `PUBLISHED` in the public catalog with a working 3D try-on rendering its real model.

**Implementation notes (v1):**
- `GenerationJob` model + `GenerationJobStatus` enum live in the schema (`prisma/schema.prisma`); related to `Jewelry` via `jobs` (cascade delete).
- Provider abstraction shipped in `lib/three-gen/{types,index,manual,tripo3d}.ts`. Tripo3D is fully wired against `https://api.tripo3d.ai/v2/openapi/task` (image-to-model, model_version `v3.0-20250812`, default texture). The `pickNextAutoProvider` chain is in place but currently has only one provider — future fallbacks (e.g., Replicate-hosted open-source) slot in without touching call sites.
- Server actions in `lib/admin/jewelry-generation-actions.ts`: `startJewelryGeneration`, `pollJewelryJob`, `approveJewelryJob`, `rejectJewelryJob`. Auth-walled via `assertAdmin()`. Generation refuses to start if a job is already `PROCESSING` for that jewelry. Both `start` and `poll` walk the auto chain on failure (transparent fallback when more providers are added).
- Successful Tripo URLs are **re-hosted on our Vercel Blob** (`rehostGlb`) before being recorded as `GenerationJob.resultGlbUrl`, since Tripo's CDN URLs are short-lived. The admin's "Утвердить" action copies that Blob URL onto `Jewelry.glbUrl` and flips `status = PUBLISHED`.
- Showroom `<EquippedPieces>` already loads `glbUrl` (Suspense per piece, scene clone per instance), so approved models render in `/catalog` immediately.
- Manual `.glb` upload is unchanged (`uploadJewelryGlb`), still bypasses `GenerationJob` for direct/recovery uploads.
- **Dry-run mode** (`DRY_RUN_3D_GEN=1`) short-circuits the Tripo3D adapter: `start()` returns a dummy `dry-run-…` job-id, `poll()` resolves to a Khronos sample GLB. Lets developers walk the full UI flow (generate → poll → approve → showroom render) at zero cost. Admin UI surfaces a "Режим теста" banner when active.
- **Polling is currently manual** — admin clicks "Обновить статус" between visits. The Vercel Cron endpoint at `/api/cron/poll-jobs` to drive this automatically is deferred to Task 15 (deployment).
- Each non-dry-run `Сгенерировать 3D` click costs Tripo3D credits (real money). The button is disabled when no photos are uploaded yet.

---

## Task 9: User authentication (guest + optional account) ✅

**Objective:** users can optionally have accounts for booking history; guest bookings still work without signup.

**Implementation guidance:**
- Add `User` flows in Auth.js: Credentials provider for optional accounts (email/password), plus a "guest" path that creates `User(isGuest=true)` from booking-form data without a password.
- Build `/auth/sign-up` and `/auth/sign-in` pages in Russian.
- Build `/account` page (booking history) — only visible when signed in with a non-guest account.
- De-duplicate users by email: if a guest later signs up with the same email, link by email match and flip `isGuest=false`, preserving history (see [`04-data-model.md`](./04-data-model.md)).

**Demo:** Sign up as a real user → see empty `/account`; or proceed as guest from the booking form (Task 11) — both paths produce a valid `User` row.

**Implementation notes (v1):**
- **Two credentials providers** in `lib/auth.ts`: `admin-credentials` (existing) and `user-credentials` (new). `user-credentials.authorize` rejects guest rows (no password) and admin rows (separate provider). The JWT carries `role: "admin" | "user"` for routing decisions.
- `auth.config.ts` `authorized` callback now branches on three scopes: `/admin/*` requires `role==="admin"` (otherwise → `/admin/login`); `/account/*` requires `role==="user"` (otherwise → `/auth/sign-in?callbackUrl=...`); `/auth/sign-in` and `/auth/sign-up` redirect already-signed-in users to `/account`.
- `proxy.ts` matcher extended: now covers `/account`, `/account/:path*`, `/auth/sign-in`, `/auth/sign-up` in addition to `/admin/*`.
- **Sign-up server action** (`signUpAction` in `lib/user/auth-actions.ts`) handles the **guest-upgrade** case: if a `User` exists with `isGuest: true`, it updates name/passwordHash/isGuest in place — so all prior `JewelryBooking` and `Appointment` rows owned by that user automatically belong to the upgraded account. If a non-guest with the same email exists, the action returns "Этот email уже зарегистрирован." On success, the action calls `signIn("user-credentials", ...)` which redirects to `/account`.
- **Sign-in flow** mirrors the admin pattern (CredentialsSignin → friendly RU error). Custom `callbackUrl` is supported.
- **`/account` page** fetches the user's bookings + appointments, renders them in two cards with status badges (reusing the `statusLabels` from Task 14), shows a Выйти button.
- **Header is now async** — reads `auth()` and conditionally renders `{user.name} | Выйти` instead of `Войти / Регистрация`. `MobileMenu` accepts a `user` prop and mirrors the same logic in the drawer.
- **Booking flow pre-fill**: `/book/page.tsx` calls `getCurrentPublicUser()` and passes `{ name, email }` into `<ContactStep>`; logged-in users see their name and email pre-filled in the contact form (phone still required since we don't store it on User after the upgrade).
- **`lib/auth-helpers.ts`** exposes `getCurrentPublicUser()` — convenience wrapper that returns null for admin sessions (so admins don't accidentally show up on `/account` or pre-fills).

---

## Task 10: Availability slots (admin CRUD) ✅

**Objective:** admin can publish, edit, and delete time slots for appointments.

**Implementation guidance:**
- Admin `/admin/slots`: week calendar view + list; single create; bulk create ("create 60-min slots Tue–Sat 11:00–19:00 for next 4 weeks"); edit; delete (only if no appointment attached); toggle `isOpen`.
- Public availability endpoint (used in Task 11) returns only `isOpen=true` slots that have no `Appointment` attached.

**Demo:** Admin bulk-creates a week of slots → adjusts a couple → deletes one → list reflects each change correctly.

**Implementation notes (v1):** Bulk + single-create CRUD shipped — bulk is the primary path for the piercer's monthly cadence (the studio plans availability one month at a time at the start/end of each month).
- `/admin/slots` lists slots from today onward, grouped by day with RU date labels.
- **Bulk create** (primary): admin picks a date range, day-of-week chips (defaults to Tue-Sat), working hours, slot length (defaults 60 min). The form shows a live "Будет создано: N окон" preview as you type. Server action iterates the range, generates `(end - start) / slotMin` slots per matching day, dedupes against existing slots by `startsAt`, and uses `createMany` so re-running is idempotent. Cap of 500 slots per submission to avoid runaway requests.
- Single-slot create still available under a `<details>` disclosure for one-off tweaks (holiday make-up, late-night appointment, etc.).
- Toggle open / closed via `toggleSlotOpen` server action.
- Delete via `deleteSlot` (refuses if a non-cancelled appointment is attached; admin sees the inline "Нельзя удалить — слот уже забронирован" hint).
- **Deferred:** in-place slot editing, week-calendar visualization, "копировать прошлый месяц" template, per-day hour overrides, holiday skipping. None block monthly planning — admin can adjust individual slots via toggle/delete after a bulk run.

---

## Task 11: Booking flow — appointment + jewelry(ies) (combined or alone) ✅

**Objective:** users can book one or many jewelries, an appointment, or both in one combined flow with no payment.

**Implementation guidance:**
- Public `/book` page: stepper UI:
  1. Choose what: `Запись на услугу` / `Бронь украшения` / `И то, и другое`.
  2. If jewelry: **multi-select** from the published catalog (search/filter); pre-fills from `?items=...` deep-link carrying the showroom tray from `/catalog` or the storytelling landing.
  3. If appointment: pick an open slot from a calendar.
  4. Contact details (name, email, phone, optional notes); pre-filled if signed in.
  5. Confirm — review summary lists every chosen jewelry with its price.
- Server action atomically: upserts `User`, creates `Appointment` (if applicable), creates **one `JewelryBooking` per chosen jewelry**, decrements `Jewelry.inStock` for each (rejects the entire transaction if any is out of stock), links every booking to the appointment via `appointmentId` for the combined flow. Use a Prisma transaction (see [`06-flows.md`](./06-flows.md)).
- `/book/success` confirmation page with a summary listing all bookings.
- Wire `Забронировать` on `/catalog/[id]` to deep-link into `/book?items=...` carrying the current try-on tray.

**Demo:** Demoed end-to-end — appointment only, single jewelry, multiple jewelries (e.g., three pieces), and the combined "appointment + multiple jewelries" flow; admin sees one appointment with three linked bookings; stock decrements on each piece.

**Implementation notes (v1):**
- Schema: added `AvailabilitySlot`, `Appointment`, `JewelryBooking` + status enums (`AppointmentStatus`, `JewelryBookingStatus`); `Appointment.slotId` is `@unique` so the DB enforces "at most one appointment per slot" without an application-level lock; `User` got booking relations.
- Stepper is **URL-driven** (`/book?step=purpose|jewelry|slot|contact&purpose=...&items=...&slot=...`). Server components dispatch by `step`. No client-side state machine. Browser back/forward + refresh + deep-link all just work. Steps that don't apply to the chosen purpose are auto-skipped (`appointment`-only skips jewelry, `jewelry`-only skips slot).
- Jewelry pre-fill from `?items=...` works from both the showroom tray (`Забронировать` button under tray) and the catalog detail page (`Забронировать` activated; out-of-stock state shows a disabled button instead).
- Final form is the only client component (`ContactStep`). It uses `useActionState` against `createBooking`.
- **`createBooking` transaction** runs in `prisma.$transaction(async (tx) => {...})`:
  - Upserts `User` by email (always `isGuest: true` in v1; public auth lands in Task 9 and will then flip the flag for matching emails).
  - Atomic stock decrement via `tx.jewelry.updateMany({ where: { id, status: PUBLISHED, inStock: { gte: 1 } }, data: { inStock: { decrement: 1 } } })` — Postgres re-evaluates the predicate under row lock, so two concurrent calls can't both pass.
  - Out-of-stock surfaces as a friendly "«<name>» закончилось — выберите другое." message that the client picks up via `useActionState`.
  - Slot conflict: pre-check + DB unique constraint as belt-and-suspenders. P2002 on insert produces "Это окно уже забронировали."
  - On success → `redirect("/book/success?ids=<bookingIds>&apt=<appointmentId>")`.
- `/book/success` re-fetches the created bookings + appointment to render a summary, so the URL is shareable / refreshable / printable.
- Empty-state for `slot` step: "Свободных окон пока нет." Admin must publish slots in `/admin/slots` first.
- **Deferred:** email + Telegram confirmations (Task 12), pre-fill from authenticated session (Task 9), admin booking dashboards (Task 14).

---

## Task 12: Notifications (Resend email + Telegram) ✅

**Objective:** every booking triggers an email confirmation to the user, an email to the admin, and an instant Telegram alert to the admin.

**Implementation guidance:**
- Implement `lib/notifications/email.ts` (Resend) with RU templates: `bookingConfirmedUser`, `bookingNotifyAdmin`, `appointmentConfirmedUser`, `appointmentNotifyAdmin`.
- Implement `lib/notifications/telegram.ts` using the Telegram Bot API; admin chat id read from `Settings.telegramChatId`.
- Hook both into the booking server actions from Task 11; also send on admin status changes (confirm / cancel / complete) where useful.
- Add a `Тестовое уведомление` button in `/admin/settings` that fires a test email + Telegram message and reports success/failure inline.

**Demo:** Make a booking → user receives a Russian email confirmation; admin receives email + Telegram message instantly with all details and a deep link into `/admin/bookings/[id]`.

**Implementation notes (v1):**
- `lib/notifications/email.ts` wraps Resend (`resend@^6`). `isEmailConfigured()` requires both `RESEND_API_KEY` and `RESEND_FROM_EMAIL`. Missing config → graceful no-op + console warning, never blocks bookings.
- `lib/notifications/telegram.ts` uses raw `fetch` against `https://api.telegram.org/bot<TOKEN>/sendMessage`, plain-text body (no MarkdownV2 escaping pitfalls). Bot token in env, admin chat id in `Settings.telegramChatId`.
- `lib/notifications/templates.ts` collapses the original four templates into two events (user-confirmation, admin-alert) covering both jewelry-only and combined flows. Each event renders for both Email (HTML + plain-text) and Telegram (plain-text with emoji).
- `lib/notifications/index.ts` orchestrates: fetch booking + appointment + user, dispatch all three legs in parallel via `Promise.all`. Each leg is independent — failure of one doesn't block the others. Returns a per-leg status report for logging.
- Booking action wires the dispatch via Next 16's `after()` from `next/server` — runs **after** the redirect to `/book/success` completes, so notification latency never delays the user's success page.
- `Тестовое уведомление` button at `/admin/settings` → `runNotificationTest` server action → `sendTestNotification`. Renders a per-leg ok/skipped/failed indicator with a friendly Russian reason ("Resend не настроен", "Chat id не указан в Настройках", etc.).
- `APP_URL` env var feeds the admin deep-link in emails/Telegram; relative URL when unset (fine in dev).
- **Deferred to Task 14:** notifications on admin status transitions (Подтвердить / Отменить / Завершить). The infrastructure is in place; Task 14 just needs to call `sendBookingNotifications` (or a more specific helper) from the relevant admin actions.

---

## Task 13: Storytelling landing page ✅

**Objective:** the home page becomes a guided narrative through the multi-piece try-on and booking, with free escape hatches at every chapter.

**Implementation guidance:**
- Rebuild `/` as a snap-scroll narrative:
  - **Hero** — full-bleed visual, studio name, CTA `Начать`.
  - **Chapter 1: `Выбери украшение`** — six featured jewelries (`featured=true`) in an animated showcase; clicking adds to the look (the first pick auto-advances; further picks accumulate in the tray). Optional `Добавить ещё одно` for picking more without leaving Chapter 1.
  - **Chapter 2: `Выбери место`** — embeds the showroom scene (or a slimmer variant) pre-loaded with the chosen jewelry/jewelries; tray UI for managing pieces; user picks anchors for each piece.
  - **Chapter 3: `Запишись`** — embedded mini booking flow (slot picker + contact details), pre-filled with all chosen jewelries + anchors.
- Each chapter has `Пропустить` and `Перейти в каталог` exits.
- State persists across chapters via the URL `?items=jewelryId:anchorSlug,...` param (or the showroom's `?eq=...`); deep-linkable + shareable.
- Fallback on devices without WebGL: Chapter 2 shows the chosen jewelries' photo galleries with a `Перейти в каталог` CTA instead of the 3D viewer (the same fallback the showroom uses).

**Demo:** Open `/` on desktop and phone → walk through all three chapters end-to-end fitting two pieces and producing a real booking with both; or skip from Chapter 1 directly into `/catalog`.

**Implementation notes (v1):**
- `/page.tsx` rewritten to compose `StoryHero` + `StoryChapter1` + `StoryChapter2` + `StoryChapter3`. Each section is `min-h-screen` with its own anchor (`#story-hero`, `#story-ch1`, etc.); `Начать` and inter-chapter buttons are anchor links so smooth-scroll feels natural without strict snap-scroll wiring.
- **URL state is unified** across the landing under `?eq=anchorSlug:jewelryId,...` (same contract as the standalone showroom). Chapter 1 picks auto-equip on each jewelry's first compatible anchor; Chapter 2 lets the user move them around; Chapter 3 reads the same state for its booking link. Refresh-safe, deep-linkable.
- `Showroom` got two new props: `pathname` (default `/catalog`, set to `/` for embedded use so URL writes stay on the landing) and `hideGridLink` (so the embedded viewport doesn't show the "Простой каталог" toggle).
- `Showroom` is now **height-agnostic** — parent controls. `/catalog/page.tsx` wraps it in `lg:h-[calc(100vh-4.5rem)]`; `StoryChapter2` wraps it in a fixed `80vh` rounded container so the chapter stays scroll-friendly.
- **Animated showcase / `Добавить ещё одно` button** are deferred — Chapter 1 ships as a clean hover-and-click grid that handles the multi-piece equip pattern. Animation is polish.
- **Inline mini booking flow** in Chapter 3 is replaced by a hand-off CTA → existing `/book?items=...`. Building a second booking flow inline would duplicate Task 11; the existing flow already accepts the `?items=` deep-link.
- **WebGL fallback** for Chapter 2: the embedded `Showroom` reuses the same dynamic-import (`ssr:false`) loader. If WebGL fails, the user sees the loading shell; for explicit fallback they can click any "В каталог" link to land on `/catalog?view=grid`. Auto-fallback (FPS detection or capability check) is tracked for Task 15.

---

## Task 14: Admin operations dashboards ✅

**Objective:** the admin can fully run the studio from the panel — see what's pending, transition statuses, adjust stock, manage settings.

**Implementation guidance:**
- `/admin` dashboard: overview cards (pending bookings, today's appointments, jewelry awaiting review, low-stock items).
- `/admin/bookings`: list + filters (status, date range, search by user email/phone); detail view; status transitions (`Reserved → Confirmed → Fulfilled` / `Cancelled`); free-text admin notes.
- `/admin/appointments`: similar list/detail; status transitions (`Pending → Confirmed → Completed` / `No-show` / `Cancelled`); shows linked jewelry if any.
- Inline stock adjustment from the jewelry list.
- Status changes can re-trigger user notifications (opt-in checkbox).

**Demo:** Admin can fully run the studio from the panel: see the day's appointments, confirm them, mark them completed, manage stock, see who reserved what — all in Russian.

**Implementation notes (v1):**
- Dashboard rewritten as 4 deep-linkable cards: Pending Bookings (RESERVED), Today's Appointments (CONFIRMED with slot today), Pending Review (Jewelry status PENDING_REVIEW), Low Stock (`inStock <= 1`). Cards highlight in primary/warn tones when their counts are non-zero.
- `/admin/bookings`: list with status filter, sortable by created date, columns include status badge / jewelry name / client / price. `/admin/bookings/[id]` detail shows client, jewelry, linked appointment, status transitions (Подтвердить / Отметить выполненным / Отменить — gated by current status), notes editor.
- `/admin/appointments`: list with status + "только сегодня" filters, sorted by slot start time. `/admin/appointments/[id]` detail shows client, slot, linked bookings, all 5 transitions (Подтвердить / Завершить / Не явился / Отменить — gated). Marking COMPLETED cascades all linked active bookings to FULFILLED.
- **Stock restoration** on cancellation: the `transitionBooking` action atomically increments `Jewelry.inStock` when transitioning to CANCELLED for the first time. FULFILLED keeps stock decremented (the customer kept the piece).
- **Inline stock +/-1** via `<StockAdjuster>` client island on `/admin/jewelry` list. Decrement uses `updateMany({ inStock: { gt: 0 } })` to avoid going below zero.
- **Re-trigger notifications**: every status-transition form has a `Уведомить клиента` checkbox (defaults to checked). Status-change emails use the new `userStatusChangeEmail` template + `sendStatusChangeNotification` helper, with separate copy per booking/appointment status. Emails fire via Next 16's `after()` so they never block the admin click.
- **Deferred:** date-range filter, search by email/phone, bulk "Confirm appointment + linked bookings" action, calendar view for appointments. All polish — admin can already run the studio without them.

---

## Task 15: Mobile responsiveness pass, 3D performance pass, and Vercel deployment ✅

**Objective:** ship the v1 to production with confident performance and a fully verified live setup.

**Implementation guidance:**
- Audit every page on real phones; fix breakpoints, touch targets, scroll snapping.
- 3D performance pass: verify Draco / KTX2 are applied to the body GLB and to jewelry models; clamp DPR (`dpr={[1, 2]}`); use `<Suspense>` + skeletons; lazy-load jewelry GLBs.
- Add automatic WebGL2 capability check + graceful fallback wherever 3D is used (currently only an opt-in `?view=grid`).
- Replace the procedural placeholder mannequin with a real body GLB; re-tune anchor positions in the seed.
- Configure Vercel project: Neon (`DATABASE_URL` / `DIRECT_URL`), Vercel Blob, Resend domain (DNS for sender), Telegram bot token (`TELEGRAM_BOT_TOKEN`) and admin chat id from the Settings UI, Tripo3D API key, NextAuth secret.
- Set up Vercel Cron for `/api/cron/poll-jobs`.
- Document all env vars in `README.md` and a deployment checklist.
- Final smoke test: the full path through admin + public flows on the live URL from desktop and a mid-range Android phone.

**Demo:** Live on a Vercel URL — admin logs in, adds a jewelry with auto-3D, approves it; user opens `/` on a phone, walks the storytelling flow, books an appointment + jewelry; admin gets email + Telegram instantly and confirms from the panel.

**Implementation notes (v1):**
- **`/api/cron/poll-jobs`** route handler shipped (`app/api/cron/poll-jobs/route.ts`). Polls every `PROCESSING` `GenerationJob` (cap 50/tick), applies the same state-transition logic as the admin "Обновить статус" button: poll → on success re-host the GLB on Vercel Blob and flip jewelry to `PENDING_REVIEW`; on fail, walk `pickNextAutoProvider()` chain and re-queue, or terminal-fail. Auth via `Authorization: Bearer ${CRON_SECRET}` (open in dev when `CRON_SECRET` is unset).
- **`vercel.json`** schedules the cron at `*/2 * * * *` (every 2 minutes). Tripo image-to-model typically completes in 1-3 minutes, so 2 minutes catches successes within one cycle.
- **Automatic WebGL2 capability check** via `lib/catalog/use-webgl2.ts` (`useWebGL2Supported()` hook). Showroom early-returns to `<CatalogGridFallback>` (the same 2D layout `?view=grid` uses) when the browser reports no `webgl2` context. Loading state is null → renders the dynamic-import shell until the check resolves.
- **`frameloop="demand"`** on the showroom Canvas with proper invalidation: `CameraRig` flips an `isMovingRef` on anchor change, `useFrame` lerps + `invalidate()`s until the camera converges (then snaps to target and idles). Selected `AnchorDot` self-invalidates per frame so the pulse stays alive on demand. End result: scene goes to ~0% GPU when nothing's animating — big mobile-battery win.
- **`Showroom` height-agnostic refactor** (already shipped in Task 13) — parent decides height via wrapper div. `/catalog` uses `lg:h-[calc(100vh-4.5rem)]`; landing chapter 2 uses `h-[80vh]`.
- **README deployment checklist** documents every env var (with required/optional flags), DNS setup hint for Resend, Vercel Cron config, smoke checklist for the live URL.
- **`.env.example`** updated with `CRON_SECRET` documentation.
- **Real body GLB** (`public/models/body/body.glb`) was wired by the parallel Blender-pipeline track that runs alongside this app session — see "Body model pipeline" in README. Anchor positions live in `prisma/seed-data/anchors.json`. Procedural Mannequin component was retired in favour of `BodyModel`.
- **Deferred to live-deploy:** real-device testing on Android (code-side audit only), Resend DNS verification (user-side), Vercel project setup (user-side). The smoke checklist in README walks the user through these post-deploy steps.

---

## Phase 2 — what shipped after the v1 roadmap

The 15 tasks above are the v1 (Phase 1) closure. After v1 went live, five
additional work streams from [`docs/13-phase-2.md`](./13-phase-2.md)
were implemented. Each one has its own deep-dive doc in this folder:

- **Photo-upload lite mode** — [`15-lite-mode.md`](./15-lite-mode.md)
- **Reviews & testimonials** — [`16-reviews.md`](./16-reviews.md)
- **Lightweight SEO bundle** — [`17-seo.md`](./17-seo.md)
- **Replicate 3D generation** (managed inference) — [`18-replicate-3d.md`](./18-replicate-3d.md)
- **React Native mobile app** (Expo + WebView shell) — [`19-mobile-app.md`](./19-mobile-app.md)

Two streams from `13-phase-2.md` remain deferred without a concrete
business trigger: **payments** (deposit / full-payment flow) and
**multi-piercer / multi-studio** (breaking schema change). These are
intentionally out of scope until there's a real reason to implement them.
