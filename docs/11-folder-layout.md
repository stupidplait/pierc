# 11 — Folder Layout

Actual Next.js (App Router) project structure as of the end of Phase 2
work streams 1–5. Reflects routes from [`05-page-map.md`](./05-page-map.md)
and the modules referenced across the deep-dive docs.

```
app/
  (public)/
    page.tsx                        // storytelling landing
    about/page.tsx                  // + LocalBusiness JSON-LD + featured reviews
    services/page.tsx
    catalog/page.tsx                // showroom + lite-mode auto-fallback
    catalog/[id]/page.tsx           // + per-piece reviews
    gallery/page.tsx
    book/page.tsx
    book/success/page.tsx           // robots: noindex
    faq/page.tsx
    account/page.tsx
    auth/sign-in/page.tsx
    auth/sign-up/page.tsx
    review/[token]/page.tsx         // ★ Phase 2 — magic-link review form
    review/thanks/page.tsx          // ★ Phase 2 — post-submit confirmation
    layout.tsx
  admin/
    (protected)/
      layout.tsx                    // assertAdmin + sidebar
      page.tsx                      // dashboard cards
      jewelry/...                   // list + new + [id]/edit (with sprite manager + GLB manager)
      slots/page.tsx                // bulk + single slot CRUD
      bookings/...
      appointments/...              // detail page exposes "Send review request"
      reviews/...                   // ★ Phase 2 — list + new + [id]/edit
      content/...                   // about / services / faq / gallery
      settings/page.tsx
    login/page.tsx
  api/
    auth/[...nextauth]/route.ts
    health/route.ts
    cron/poll-jobs/route.ts         // 3D job poller
    jewelry-glb/[id]/route.ts       // signed GLB streaming
  .well-known/                      // ★ Phase 2 — mobile universal-links
    apple-app-site-association/route.ts
    assetlinks.json/route.ts
  sitemap.ts                        // ★ Phase 2 — auto-generated sitemap.xml
  robots.ts                         // ★ Phase 2 — auto-generated robots.txt
  layout.tsx                        // root: metadataBase, fonts, <Analytics />
  globals.css

components/
  catalog/                          // 3D showroom (Three.js + R3F)
    Showroom.tsx                    // → LiteMode on WebGL2-fail
    ShowroomScene.tsx
    AnchorDots.tsx
    EquippedPieces.tsx
    BodyModel.tsx
    CameraRig.tsx
    CatalogSidebar.tsx              // reused by LiteMode
    CatalogGridFallback.tsx         // reused by LiteMode "Все украшения" toggle
  lite/                             // ★ Phase 2 — photo-upload lite mode
    LiteMode.tsx                    // top-level container
    SelfieDropzone.tsx
    SelfieCanvas.tsx                // FaceLandmarker + sprite compositing + drag-nudge
    LiteBanner.tsx
  admin/
    JewelryForm.tsx, JewelryGenerationActions.tsx, ...
    JewelryModelManager.tsx         // GLB
    JewelrySpriteManager.tsx        // ★ Phase 2 — sprite for lite-mode
    JewelrySpriteUploader.tsx       // Auto/Manual segmented control
    SpriteAutoRemover.tsx           // in-browser bg-removal
    ReviewForm.tsx                  // ★ Phase 2
    ReviewPhotoUploadForm.tsx       // ★ Phase 2
    StatusBadges.tsx                // booking / appointment / review states
    ...
  landing/                          // storytelling chapters
    StoryHero.tsx
    StoryChapter1.tsx
    StoryChapter2.tsx               // WebGL2-fail → CTA to /catalog
    StoryChapter3.tsx
  public/
    Header.tsx, Footer.tsx, MobileMenu.tsx
    PublicAuthForm.tsx
    TestimonialCard.tsx             // ★ Phase 2 — reused on /about + /catalog/[id]
    ReviewSubmitForm.tsx            // ★ Phase 2 — magic-link form
  booking/                          // step components for /book
  ui/                               // Button, Card, PageHeader, Section

lib/
  prisma.ts
  auth.ts, auth-helpers.ts
  i18n/ru.ts                        // single RU string table (admin + public + seo + reviews + lite)
  catalog/
    types.ts, url-state.ts          // ?eq=… contract
    use-webgl2.ts                   // useSyncExternalStore-based capability check
  jewelry/format.ts
  admin/                            // server actions per resource
    jewelry-actions.ts
    jewelry-generation-actions.ts
    review-actions.ts               // ★ Phase 2
    appointment-actions.ts
    booking-actions.ts
    content-actions.ts
    slot-actions.ts
    telegram-test-action.ts
    auth-helpers.ts
  booking/actions.ts, url-state.ts
  user/auth-actions.ts
  three-gen/                        // provider abstraction (3D image-to-model)
    index.ts                        // pickAuto / pickNextAuto / getProviderStatus
    types.ts                        // Provider interface, ProviderId union
    replicate.ts                    // ★ Phase 2 — managed inference (PRIMARY)
    tripo3d.ts                      // demoted to fallback
    manual.ts                       // no-op for direct uploads
  notifications/
    index.ts                        // sendBookingNotifications / sendStatusChange / sendReviewRequestEmail
    templates.ts                    // user/admin/review-request HTML+text
    email.ts                        // Resend
    telegram.ts
  reviews/                          // ★ Phase 2
    token.ts                        // jose JWT sign/verify
    submit-action.ts                // public magic-link form action
  lite/                             // ★ Phase 2 — photo-upload try-on internals
    types.ts
    anchor-config.ts                // 7 v1 face anchors → MediaPipe landmark idx
    face-landmarker.ts              // lazy MediaPipe wrapper
    bg-removal.ts                   // lazy @imgly/background-removal wrapper
    canvas-render.ts                // composite + saveToImage
    wasm-urls.ts                    // self-hosted Blob URLs for WASM models
  seo/                              // ★ Phase 2
    metadata.ts                     // buildPageMetadata helper
    local-business.ts               // JSON-LD builder for /about
  public/queries.ts                 // shared public-side data fetchers

prisma/
  schema.prisma                     // + Review + ReviewStatus + Jewelry.spriteUrl + Appointment.reviewedAt
  seed.ts
  seed-data/
    anchors.json                    // 28 body anchors
    jewelry.json                    // parametric jewelry manifest
    jewelry-uploads.json            // slug → Blob URL map (committed)

scripts/
  jewelry-upload.ts                 // Phase 1 — push art/jewelry-out/*.glb to Blob
  blender/                          // body + jewelry pipelines via blender-mcp
  anchors/generate-camera-presets.mjs
  lite/upload-wasm-assets.mjs       // ★ Phase 2 — mirror MediaPipe + imgly WASM to Blob

mobile/                             // ★ Phase 2 — Expo + WebView shell
  app/                              // expo-router routes
    _layout.tsx                     // splash + deep-link handler
    (tabs)/_layout.tsx              // bottom tab nav
    (tabs)/{index,catalog,book,account}.tsx
    +not-found.tsx
  components/PiercWebView.tsx       // WebView wrapper (back btn, share, external links)
  constants/config.ts               // APP_URL + tab table
  lib/tab-registry.ts               // deep-link → WebView ref bridge
  assets/{icon.png, splash.png}     // placeholder branded assets
  app.json                          // Expo config (deep-links, plist, intent filters)
  eas.json                          // EAS Build profiles
  package.json, tsconfig.json
  README.md                         // dev workflow + App Store / Play Store checklist

public/
  models/body/body.glb              // ~340 KB Draco-compressed mannequin
  jewelry-glb/*.glb                 // built parametric pieces (mirrored from art/jewelry-out/)
  og/home.jpg                       // ★ Phase 2 — default OpenGraph share image

docs/
  README.md, 01-overview.md, 02-requirements.md, 03-architecture.md,
  04-data-model.md, 05-page-map.md, 06-flows.md, 07-3d-fitting.md,
  08-auto-3d-pipeline.md, 09-admin-panel.md, 10-content-strategy.md,
  11-folder-layout.md, 12-tasks.md, 13-phase-2.md, 14-jewelry-pipeline.md,
  15-lite-mode.md,         // ★ Phase 2 work stream 1
  16-reviews.md,           // ★ Phase 2 work stream 2
  17-seo.md,               // ★ Phase 2 work stream 3
  18-replicate-3d.md,      // ★ Phase 2 work stream 4
  19-mobile-app.md         // ★ Phase 2 work stream 5
```

## Conventions

- **Route groups:** `(public)` keeps public pages co-located without affecting the URL; `(protected)` inside `admin/` walls off authenticated routes from `/admin/login`. `admin/` is a real path segment because URL prefix matters for middleware-based auth.
- **API surface:** under `app/api/` for HTTP handlers (cron, health, signed-blob streaming). Form submissions use **server actions** in `lib/<scope>/<thing>-actions.ts`, not Route Handlers.
- **Shared logic** lives in `lib/`. Components stay dumb where possible. Phase 2 introduced four new feature modules — `lib/lite/`, `lib/reviews/`, `lib/seo/`, plus `lib/three-gen/replicate.ts` slotted into the existing provider abstraction.
- **String table:** every Russian UI string goes through `lib/i18n/ru.ts`. New Phase 2 bundles: `seoStrings.*`, `reviewsStrings.*`, `catalogStrings.liteMode.*`, `ru.admin.reviews.*`, `ru.admin.jewelry.sprite.*`.
- **3D assets:** static body model under `public/models/body/`. Jewelry GLBs are uploaded to Vercel Blob and referenced via `Jewelry.glbUrl`. Sprite PNGs (lite mode) sit on Blob via `Jewelry.spriteUrl`. WASM assets for lite mode are mirrored to Blob via `npm run lite:wasm`.
- **Prisma:** one client singleton in `lib/prisma.ts` to avoid connection storms in serverless functions. Schema migrations via `prisma db push` (no `prisma/migrations/` folder).
- **Mobile:** `mobile/` is a sibling Expo project sharing the same git repo but with its own `package.json`, `tsconfig.json`, and `node_modules/`. Vercel deploy of the Next.js app is unaffected — the root `tsconfig.json` excludes `mobile`.
