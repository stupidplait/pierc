# 05 — Page Map

> **Partially outdated.** The `/catalog` description below predates the current
> 3D showroom. The live catalog renders through `components/catalog/Showroom.tsx`
> → `CatalogStage` → `CardsLayer`; the older `<ShowroomScene>` / `<Mannequin>` /
> `CatalogSidebar` names no longer match, and `CatalogControls` is now only the
> lite-mode / mobile fallback.

## Route overview

```
/                      Storytelling landing (Hero → Ch.1 → Ch.2 → Ch.3)
/about                 Studio + piercer story + #contact + LocalBusiness JSON-LD + featured reviews
/services              Piercing services list with prices (admin-managed)
/catalog               3D showroom — auto-fallback to lite mode when WebGL2 unavailable
/catalog/[id]          Jewelry description + photos + per-piece reviews + "Примерить" deep-link
/gallery               Real work photos (admin-managed)
/book                  Combined booking flow (jewelry + appointment, either alone)
/book/success          Confirmation (noindex)
/faq                   FAQ (admin-managed)
/account               (Optional) user booking history — only if signed in
/auth/sign-in          User sign-in (optional)
/auth/sign-up          User sign-up (optional)
/review/[token]        Magic-link review submission (Phase 2 — see docs/16-reviews.md)
/review/thanks         Post-submit confirmation
/sitemap.xml           Auto-generated sitemap (Phase 2 — see docs/17-seo.md)
/robots.txt            Auto-generated robots
/.well-known/apple-app-site-association   Universal Links manifest (gated on APPLE_TEAM_ID env)
/.well-known/assetlinks.json              Android App Links manifest (gated on ANDROID_SHA256_FINGERPRINT env)

/admin                 Admin dashboard
/admin/login           Admin login (separate from user auth)
/admin/jewelry         List + create/edit (with auto-3D pipeline + sprite manager for lite mode)
/admin/anchors         (Seed/inspect anchor points)
/admin/slots           Availability slots CRUD
/admin/bookings        Jewelry bookings list
/admin/appointments    Appointments list (with manual review-request resend)
/admin/reviews         Reviews moderation (Phase 2 — see docs/16-reviews.md)
/admin/content         About / Services / FAQ / Gallery editing
/admin/settings        Contact info, Telegram chat ID, branding
```

`/contact` is a permanent **308 redirect** to `/about#contact` (configured in `next.config.ts`); the old standalone contact page no longer exists. The merge keeps "studio" and "how to find us" as one mental surface.

## Public navigation (header)

The header surfaces 5 nav links + 3 right-side actions:

```
[logo]   Главная · О студии · Услуги · Каталог · Галерея · FAQ        Войти · Регистрация · [Записаться]
```

- The logo links to `/`; `Главная` is also a nav link for clarity.
- `О студии` → `/about` (covers studio, piercer, contacts).
- `Записаться` is a primary button (separate from the nav links so it never gets lost in a list).
- `Войти` / `Регистрация` are stubs in v1 (link to `/auth/sign-in` / `/auth/sign-up` placeholder pages); real public auth lands alongside the booking flow.
- Mobile drawer mirrors all of the above and pins `Записаться` at the bottom.

## Public routes

### `/` — Storytelling landing
- **Data:** `Jewelry` where `featured = true` (limit 6) for Chapter 1; `AnchorPoint` for Chapter 2; `AvailabilitySlot` for Chapter 3.
- **Components:** `<HeroSection>`, `<ChapterOne>` (animated showcase), `<ChapterTwo>` reusing the showroom 3D scene, `<ChapterThree>` (mini booking).
- **Mobile:** scroll-snap, full-bleed sections, large touch targets, falls back to a photo carousel if WebGL is missing.

### `/about`
- **Data:** `SiteContent(key="about")` for the body copy + `Settings` for the contact section.
- **Components:** rich-text-light renderer + `#contact` anchor section showing email / phone / address / hours.
- **Mobile:** standard responsive prose; contact card stacks.

### `/services`
- **Data:** `Service` where `published=true`, ordered by `order`.
- **Components:** `<ServiceList>` showing name, description, price, duration.
- **Mobile:** stacked cards.

### `/catalog` — showroom
- **Data:** `AnchorPoint` (all 20 anchors with positions + camera presets); `Jewelry` where `status=PUBLISHED` with `category` + `anchors` joined.
- **Components:** `<Showroom>` (client root, owns state + URL sync), `<ShowroomScene>` (R3F Canvas dynamically imported with `ssr:false`), `<Mannequin>`, `<AnchorDots>`, `<EquippedPieces>`, `<CameraRig>`, `<CatalogSidebar>` (anchor combobox + tray + filtered list).
- **Behaviour:** click an anchor dot or pick from the combobox → camera tweens to that anchor's preset → sidebar filters to jewelry compatible with the anchor → user clicks `Примерить` to equip a piece on the active anchor. One piece per anchor; soft cap of 6 across all anchors.
- **URL state contract:**
  - `?anchor=<slug>` — focused anchor.
  - `?eq=<slug1>:<jewelryId1>,<slug2>:<jewelryId2>` — equipped pieces, deep-linkable.
  - `?view=grid` — render `<CatalogGridFallback>` (the 2D card list) instead of the 3D scene; useful when WebGL is unavailable.
- **Mobile:** stacks vertically — 3D viewport `~60vh` on top, sidebar below. Combobox is the primary anchor picker on mobile (dots are tappable but a phone-thumb on a 12px target is hard).
- **WebGL note:** v1 uses a procedural mannequin made from primitives (head sphere, neck/torso cylinders, etc.) so the showroom works without any GLB asset on disk. Anchor positions in the seed are tuned against this geometry.

### `/catalog/[id]` — jewelry description
- **Data:** `Jewelry` by id with `category`, `anchors`, `photos`.
- **Components:** photo gallery (hero + thumbs), attributes Card (material/gauge/size/color/stones/in-stock), anchor tags, `Примерить` deep-link button (links into `/catalog?anchor=<primary>&eq=<primary>:<id>`), `Забронировать` button (disabled, lands in Task 11).
- **Why it still exists:** SEO-friendly descriptive surface, bookmarkable per-product link, fallback for users who can't load the 3D showroom.
- **Mobile:** stacked layout (photo → attributes → CTAs).

### `/gallery`
- **Data:** `GalleryPhoto` where `published=true`, ordered by `order`.
- **Components:** `<MasonryGallery>` with lightbox.
- **Mobile:** single-column with lazy-loaded images.

### `/book`
- **Data:** `Jewelry` (for jewelry picker, multi-select), `AvailabilitySlot` where `isOpen=true` and not booked (for slot picker).
- **Components:** `<BookingStepper>` with 5 steps (purpose → optional jewelries (multi-select / from showroom tray) → optional slot → contact → confirm). Confirm step lists every chosen jewelry.
- **Server actions:** `createBooking(...)` upserts `User`, creates `Appointment` (if applicable), creates **one `JewelryBooking` per chosen jewelry**, decrements `Jewelry.inStock` for each (rejects atomically if any is out of stock), links every booking to the appointment via `appointmentId` for the combined flow.
- **Deep-link:** supports `?items=jewelryId1,jewelryId2,...` from `/catalog` (when the user clicks the booking CTA from the showroom) and from the storytelling landing.
- **Mobile:** one step per screen.

### `/book/success`
- Confirmation screen with summary; deep-link copies for the user; CTA back to `/catalog`.

### `/faq`
- **Data:** `FAQItem` where `published=true`, ordered.
- **Components:** accordion list.

### `/account`
- **Visibility:** signed-in users only (non-guest).
- **Data:** `JewelryBooking` and `Appointment` for the current user.
- **Components:** `<BookingHistoryList>` with status badges and cancel-request actions.

### `/auth/sign-in`, `/auth/sign-up`
- Auth.js Credentials forms in Russian. v1 ships these as stubs with placeholder copy; real flow lands alongside the booking task.
- Sign-up flow handles guest → real-account upgrade by email match (see [`04-data-model.md`](./04-data-model.md)).

### `/review/[token]` — magic-link review submission *(Phase 2)*
- **Visibility:** anyone with a valid token. The token is JWT-signed with `AUTH_SECRET`, encodes the `Appointment.id`, and expires after 60 days.
- **Flow:** customer receives a "Поделитесь впечатлением" email after the admin marks an appointment COMPLETED. Tapping the link opens this page with a pre-filled form (rating, text, name, optional photo, jewelry tags pre-selected from the appointment's bookings). Submission creates `Review(status=PENDING)` for moderation and sets `Appointment.reviewedAt` so the token can't be reused.
- **Three states:** form / token-expired / already-submitted — each with RU copy and a fallback link home.
- **Spec:** [`16-reviews.md`](./16-reviews.md).

### `/review/thanks`
- Post-submit confirmation page. RU "Спасибо за отзыв!" + back-to-home link.

### `/sitemap.xml`, `/robots.txt`, `/.well-known/*` *(Phase 2)*
- Auto-generated by Next.js's `app/sitemap.ts` + `app/robots.ts` route handlers.
- Universal Links / App Links manifests at `/.well-known/apple-app-site-association` (gated on `APPLE_TEAM_ID`) and `/.well-known/assetlinks.json` (gated on `ANDROID_SHA256_FINGERPRINT`); both 404 cleanly when the env vars are unset.
- Spec: [`17-seo.md`](./17-seo.md), [`19-mobile-app.md`](./19-mobile-app.md).

## Admin routes

All admin routes are protected by middleware that requires a valid `AdminUser` session. Unauthenticated visitors are redirected to `/admin/login`.

### `/admin` — dashboard
- Read-only overview: counts of pending bookings, today's appointments, jewelry in `PENDING_REVIEW`, low-stock items (`inStock <= 1`).

### `/admin/jewelry`
- **Operations:** list with filters/search (category, status, featured, free-text); create (uploads photos + metadata); edit; delete; trigger 3D generation (Task 8); review generated `.glb`; approve / reject; manual `.glb` upload; adjust `inStock`; toggle `featured`.
- **Guards:** standard admin session.

### `/admin/anchors`
- **Operations (v1):** read-only listing of seeded anchor points with their `position`, `rotation`, `cameraPresets`. Edit is allowed (json editor) but rarely needed. Once a real body GLB replaces the procedural placeholder, this is also where positions get re-tuned.

### `/admin/slots`
- **Operations:** list / week-calendar view; single create; bulk create ("Tue–Sat 11:00–19:00 for 4 weeks, 60-min slots"); edit; delete (only if no `Appointment` is attached); toggle `isOpen`.

### `/admin/bookings`
- **Operations:** list `JewelryBooking` with filters by status, date range, search by user email/phone; detail view; status transitions (`RESERVED → CONFIRMED → FULFILLED` / `CANCELLED`); admin notes; optional re-trigger of user notification.

### `/admin/appointments`
- **Operations:** list `Appointment` with similar filters; detail view; status transitions (`PENDING → CONFIRMED → COMPLETED` / `NO_SHOW` / `CANCELLED`); shows linked jewelry if any. The detail page also exposes a manual "Отправить запрос на отзыв" button for COMPLETED appointments where `reviewedAt` is null *(Phase 2)*.

### `/admin/reviews` *(Phase 2)*
- **Operations:** list reviews filtered by status (`PENDING` / `PUBLISHED` / `REJECTED`) and `featured` flag; create new (admin manual-entry path); edit existing — rating, text, author name, jewelry tags, photo, moderator notes, featured toggle, status transitions (Approve / Reject / Unpublish). Photo upload via Vercel Blob with auto-cleanup of replaced blobs.
- **Spec:** [`16-reviews.md`](./16-reviews.md).

### `/admin/content`
- **Operations:** edit `SiteContent` rows (About, Hero); CRUD for `Service`, `FAQItem`, `GalleryPhoto`; reorder via drag-and-drop or numeric `order` fields; toggle `published`.

### `/admin/settings`
- **Operations:** edit the `Settings` singleton (contact email/phone/address, Instagram URL, Telegram chat id, working-hours hint); `Тестовое уведомление` button to verify email + Telegram delivery end-to-end. Contact fields are surfaced both in the footer and on `/about#contact`.
