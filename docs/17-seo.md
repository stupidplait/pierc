# 17 — Lightweight SEO Bundle

> Phase 2 work stream 3. The trimmed-down "Analytics & SEO" package
> from [`13-phase-2.md`](./13-phase-2.md) — only the pieces that pay
> off immediately for a small studio with low traffic.
>
> **Status legend:** ✅ done · 🟡 partial · ⏸ paused · ⬜ not started.

A focused, low-effort SEO + analytics setup that improves how the site
is shared on social channels (link previews on Telegram / Instagram /
WhatsApp), gets the studio cleanly indexed by Google, and surfaces
traffic numbers via Vercel Analytics — without paid vendors, custom
infrastructure, or speculative structured-data work.

## Problem statement

The site already runs in production but:

- Pasting `/catalog/<piece>` into a Telegram DM shows a bare URL with
  no preview image or title.
- Google has no signal that this is a piercing studio at a specific
  address with specific hours; the local-pack listing is empty or
  generic.
- There is no traffic-volume baseline, so we have nothing to point to
  when deciding whether to invest in marketing or further features.

The full "Analytics & SEO" sketch in
[`13-phase-2.md`](./13-phase-2.md) is wider (Plausible/PostHog,
`Product` JSON-LD per piece, dedicated `/reviews` index page, etc.) —
all of which compound only with traffic the studio doesn't yet have.
This stream ships the minimum that pays off **today**, regardless of
visit counts.

## Scope

### In v1

- **`metadataBase`** on the root layout so all relative URLs in
  metadata resolve correctly.
- **OpenGraph + Twitter Cards** on every public route (`/`, `/about`,
  `/services`, `/catalog`, `/catalog/[id]`, `/gallery`, `/faq`,
  `/book`, `/book/success`). Title + description + image. Catalog
  detail pages reuse the jewelry's first photo as `og:image`.
- **Per-page descriptions** in Russian, written so the meta tag does
  double duty as the SERP snippet and the social link preview.
- **`app/sitemap.ts`** — Next.js's built-in sitemap route. Pulls
  static pages + every published jewelry detail page from the DB at
  build/request time.
- **`app/robots.ts`** — allow-all for the public site, disallow the
  admin panel and the magic-link review URLs (which are tokenized
  and shouldn't be indexed). Includes a `sitemap` reference.
- **JSON-LD `LocalBusiness`** on `/about`, populated from the
  `Settings` singleton (address, phone, hours, social URLs). Server-
  rendered as `<script type="application/ld+json">` in the page
  source so Google reads it without executing client JS.
- **Vercel Analytics** — `npm install @vercel/analytics`, mount
  `<Analytics />` in the root layout. Free at this scale, privacy-
  friendly, no cookie banner needed.

### Deliberately deferred

- **Plausible / PostHog** — Vercel Analytics covers the same basics
  for free; revisit only if its free tier proves insufficient.
- **`Product` JSON-LD per jewelry** — overkill at 21 pieces. Reassess
  once the catalog grows beyond ~50 active items or there's a clear
  Google Shopping opportunity.
- **`@vercel/og` dynamic OG image generation** — the existing studio
  photos already work for catalog detail pages and a single static
  studio image suffices for the rest. Re-evaluate if we want
  visually-richer share cards.
- **`BreadcrumbList`, `Person` (the piercer), `Service`** schema —
  long-tail SEO compounding; not worth the maintenance overhead at
  current scale.
- **`hreflang` / multi-language** — the site is RU-only by design.
- **Search Console submission, Yandex.Webmaster verification** —
  user-side post-deploy steps; not code.

## Architecture

```mermaid
flowchart LR
  subgraph Public Pages
    L[app/layout.tsx]
    H[/page.tsx home/]
    A[/about/]
    S[/services/]
    C[/catalog list/]
    CD[/catalog/[id]/]
    G[/gallery/]
    F[/faq/]
    B[/book/]
  end

  subgraph "Generated routes"
    SM[app/sitemap.ts]
    R[app/robots.ts]
  end

  subgraph SEO config
    Meta[lib/seo/metadata.ts<br/>metadataBase + helpers]
    LB[lib/seo/local-business.ts<br/>JSON-LD builder]
  end

  Meta --> L
  Meta --> H & A & S & C & CD & G & F & B
  LB --> A
  L -->|<Analytics /> island| VA[Vercel Analytics]
  SM -->|crawled URLs| Bots[(Search engines)]
  R -->|allow/disallow| Bots
```

The metadata helper is a thin wrapper that builds OG + Twitter Cards
from a few inputs (title, description, image, canonical path) so each
page only specifies what's actually unique to it.

## Per-page metadata matrix

| Route | Title | Description source | OG image |
|---|---|---|---|
| `/` | "Pierc Studio — пирсинг и 3D-примерочная" | hardcoded RU lead | `/og/home.jpg` (static) |
| `/about` | "О студии" | first ~160 chars of the about body, fallback to a default | `/og/home.jpg` |
| `/services` | "Услуги и цены" | hardcoded RU list lead | `/og/home.jpg` |
| `/catalog` | "Каталог украшений" | hardcoded RU lead | `/og/home.jpg` |
| `/catalog/[id]` | "{name} — Pierc Studio" | first ~160 chars of `description`, fallback to attributes | `firstPhotoUrl(j.photos)` |
| `/gallery` | "Галерея" | hardcoded RU lead | `/og/home.jpg` |
| `/faq` | "Частые вопросы" | hardcoded RU lead | `/og/home.jpg` |
| `/book` | "Запись и бронирование" | hardcoded RU lead | `/og/home.jpg` |
| `/book/success` | (existing) | "Бронирование оформлено" | `/og/home.jpg` |

OG images live under `public/og/` so they're served directly from
Vercel's CDN without a database lookup. A single `home.jpg` covers
all non-catalog routes; per-piece pages use the existing jewelry
photos. Catalog detail pages without any photo fall back to
`/og/home.jpg`.

## Sitemap.ts contents

```ts
// pseudo-shape
[
  { url: "/", lastModified: now },
  { url: "/about" },
  { url: "/services" },
  { url: "/gallery" },
  { url: "/faq" },
  { url: "/catalog" },
  { url: "/book" },
  // …per published jewelry…
  { url: `/catalog/${j.id}`, lastModified: j.updatedAt },
]
```

Excluded: `/admin/*`, `/account`, `/auth/*`, `/book/success`,
`/review/*` (tokenized, customer-specific). The exclusions are also
expressed in `robots.ts`.

## Robots.ts contents

```ts
{
  rules: [
    { userAgent: "*", allow: "/", disallow: ["/admin", "/account", "/auth", "/api", "/review"] },
  ],
  sitemap: `${BASE_URL}/sitemap.xml`,
}
```

`BASE_URL` is read from `APP_URL` (existing env var) at build/runtime.

## LocalBusiness JSON-LD

Embedded into `/about`'s rendered HTML as a `<script
type="application/ld+json">` tag in the `<head>` (via Next's
`generateMetadata` → `other` injection or a server-rendered island
inside the page body — both work; Google reads either).

Shape (minimum useful):

```json
{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "Pierc Studio",
  "image": "https://<deploy>/og/home.jpg",
  "url": "https://<deploy>/",
  "telephone": "<settings.contactPhone>",
  "email": "<settings.contactEmail>",
  "address": { "@type": "PostalAddress", "streetAddress": "<settings.contactAddress>" },
  "openingHoursSpecification": [{
    "@type": "OpeningHoursSpecification",
    "description": "<settings.workingHoursHint>"
  }],
  "sameAs": ["<settings.instagramUrl>", "<settings.telegramUrl>"]
}
```

Empty fields are omitted (Google tolerates partial schemas; a
half-complete record is better than a fabricated one). When
`Settings` is empty, the JSON-LD block is suppressed entirely.

## Privacy & analytics notes

- **Vercel Analytics** is privacy-friendly by design: no cookies, no
  cross-site tracking, no PII captured. Russian-side users won't
  trigger a GDPR cookie banner because there is no cookie set.
- **No tracking pixels, no Facebook Pixel, no Google Analytics** —
  matches the studio's small-business profile and avoids the
  cookie-banner UX cost.
- **OG images** are public Vercel Blob URLs (jewelry photos) or
  static assets under `public/og/`. No request-time ID leakage.

## Task list

### Task 1: Documentation ✅

This file. Plus the back-reference in
[`13-phase-2.md`](./13-phase-2.md). No application code changes.

### Task 2: Per-page metadata + Vercel Analytics ✅

- Create `lib/seo/metadata.ts` with a `buildPageMetadata({ title?,
  description, path, image? })` helper that returns a `Metadata`
  object with OpenGraph + Twitter Cards filled in.
- Set `metadataBase` on the root layout from `APP_URL`.
- Update each public page's existing `metadata` / `generateMetadata`
  export to call the helper. Provide RU descriptions per page.
- Add a static OG image at `public/og/home.jpg` (placeholder
  acceptable; admin can swap later).
- `npm install @vercel/analytics`. Add `<Analytics />` to root
  layout.

**Demo:** paste any public URL into Telegram DM → see preview image +
title + description. Vercel dashboard shows analytics events firing.

**Implementation notes:**
- `lib/seo/metadata.ts` — pure helper. Builds OpenGraph (`type`,
  `url`, `siteName`, `locale: ru_RU`, `images`) + Twitter Cards
  (`summary_large_image`) + `alternates.canonical` from a single
  input.
- `app/layout.tsx` — `metadataBase: new URL(APP_URL)` (falls back to
  `http://localhost:3000` for local dev). Default title now uses
  Next's `{ default, template }` shape so any child page that
  doesn't set its own title still inherits the right pattern.
- `<Analytics />` from `@vercel/analytics/next` mounted in `<body>`
  alongside the page tree. Free at this scale, no cookies, no
  banner.
- All 9 public routes updated to use `buildPageMetadata`:
  `/`, `/about`, `/services`, `/catalog`, `/catalog/[id]`,
  `/gallery`, `/faq`, `/book`, `/book/success`. Each draws its
  title + description from a centralized `seoStrings.*` bundle in
  `lib/i18n/ru.ts`.
- Catalog detail (`/catalog/[id]`) trims the jewelry's `description`
  to ~160 chars for the OG/SERP snippet (or falls back to a
  generic line) and uses `firstPhotoUrl(j.photos)` as
  `og:image`. Pieces without photos fall back to `/og/home.jpg`
  via the helper's default.
- `/book/success` adds `robots: { index: false, follow: false }` —
  it's a per-booking landing, no value indexing it.
- Placeholder OG image at `public/og/home.jpg` (1200×630 JPEG,
  ~23 KB, brand-pink with studio name). Generated once via
  `sharp` from an inline SVG; admin can swap by replacing the
  file.
- `seoStrings.*` bundle added to `lib/i18n/ru.ts` covering every
  route. RU descriptions sit in the 120–160 char range so they
  double as SERP snippets and social-share previews.

### Task 3: sitemap + robots + LocalBusiness JSON-LD ✅

- Create `app/sitemap.ts` (dynamic, pulls published catalog).
- Create `app/robots.ts` with allow-all for public + sitemap
  reference.
- Create `lib/seo/local-business.ts` builder.
- Inject the JSON-LD into `/about`'s response (server-rendered
  `<script>` inside the page body).
- README smoke checklist updated with: sitemap accessible at
  `/sitemap.xml`, robots accessible at `/robots.txt`, JSON-LD
  validates at https://search.google.com/test/rich-results.

**Demo:** visit `/sitemap.xml` → see XML with all public routes.
Visit `/robots.txt` → see allow-all + sitemap line. Validate
LocalBusiness JSON-LD → 0 errors.

**Implementation notes:**
- `app/sitemap.ts` — Next's `MetadataRoute.Sitemap` shape. Static
  routes (`/`, `/catalog`, `/about`, `/services`, `/gallery`,
  `/faq`, `/book`) at fixed `priority`, plus every PUBLISHED
  jewelry detail page with `lastModified` from `Jewelry.updatedAt`.
- `app/robots.ts` — single allow-all rule with disallow list for
  `/admin`, `/account`, `/auth`, `/api`, `/book/success`,
  `/review`. References `/sitemap.xml` from `APP_URL`.
- `lib/seo/local-business.ts` — `buildLocalBusinessJsonLd({ baseUrl,
  settings })` returns the schema object (or null when there's
  nothing meaningful to publish). Empty Settings fields are omitted
  cleanly. `jsonLdScript(json)` wraps `JSON.stringify` for the
  `<script>` body.
- `/about` page emits a `<script type="application/ld+json">` tag at
  the top of the rendered output via `dangerouslySetInnerHTML` (the
  payload is server-built from trusted DB data; there's no user
  input flowing into it).
- README's smoke checklist expanded with: sitemap.xml + robots.txt
  reachability, link-preview check via Telegram/WhatsApp paste,
  Rich-Results test validation, and a Vercel Analytics page-view
  spot-check.

## Risks & open questions

- **`APP_URL` must be set in production.** Without it, `metadataBase`
  defaults to `localhost`, which breaks OG previews on real shares.
  Already documented in the existing deploy checklist; no new
  surface here.
- **OG image static asset** — `public/og/home.jpg` ships as a
  placeholder (e.g., the studio logo over the brand pink). Admin can
  swap it via a normal commit; we don't expose it through the CMS in
  v1 because it changes ~zero times after launch.
- **Yandex / VK SEO** — the schemas + sitemap also help Yandex; no
  Yandex-specific work needed beyond an optional Yandex.Webmaster
  verification token (left as a user-side post-deploy step, not in
  scope).
- **Search Console submission** is a one-time user action after the
  first deploy; documented in the README but not automated.
- **Vercel Analytics free-tier limits** — if traffic spikes past the
  free quota, Vercel surfaces it in the dashboard. Not a code
  concern.
