# 11 — Folder Layout

Proposed Next.js (App Router) project structure. Reflects the routes from [`05-page-map.md`](./05-page-map.md) and the modules referenced elsewhere in the spec.

```
app/
  (public)/
    page.tsx               // storytelling landing
    about/page.tsx
    services/page.tsx
    catalog/page.tsx
    catalog/[id]/page.tsx
    gallery/page.tsx
    book/page.tsx
    book/success/page.tsx
    faq/page.tsx
    contact/page.tsx
    account/page.tsx
    auth/sign-in/page.tsx
    auth/sign-up/page.tsx
  admin/
    layout.tsx             // protected
    page.tsx               // dashboard
    login/page.tsx
    jewelry/...
    slots/...
    bookings/...
    appointments/...
    content/...
    settings/page.tsx
  api/
    auth/[...nextauth]/route.ts
    bookings/route.ts
    appointments/route.ts
    slots/route.ts
    admin/jewelry/route.ts
    admin/jewelry/[id]/generate/route.ts
    admin/jewelry/[id]/approve/route.ts
    admin/jewelry/[id]/reject/route.ts
    webhooks/tripo3d/route.ts          // optional callback
    cron/poll-jobs/route.ts            // status polling
components/
  three/                   // 3D viewer (regions, anchors, jewelry placement)
  storytelling/            // landing chapters
  forms/, ui/, admin/, public/
lib/
  prisma.ts
  auth.ts
  blob.ts
  three-gen/               // provider abstraction
    index.ts
    tripo3d.ts
    meshy.ts                  ← removed in v1; abstraction supports adding it (or other providers) back as ~50-line plug-ins
    manual.ts
  notifications/
    email.ts               // Resend
    telegram.ts            // Telegram bot
  i18n/ru.ts               // string table
prisma/
  schema.prisma
  seed.ts                  // categories, anchor points, default content
public/
  models/body/head.glb
  models/body/torso.glb
  models/body/other.glb
```

## Conventions

- **Route groups:** `(public)` keeps public pages co-located without affecting the URL. `admin/` is a real path segment because URL prefix matters for middleware-based auth.
- **API surface:** under `app/api/`. Server actions are preferred for form submissions; standalone Route Handlers are used for cron, webhooks, and anything the future React Native app will hit.
- **Shared logic** lives in `lib/`. Components stay dumb where possible.
- **3D assets** are static under `public/models/body/`. Jewelry GLBs are uploaded to Vercel Blob and referenced via `Jewelry.glbUrl`.
- **String table:** every Russian UI string goes through `lib/i18n/ru.ts`. This makes future copy changes (and a possible later RU/EN toggle) painless.
- **Prisma:** one client singleton in `lib/prisma.ts` to avoid connection-storming serverless functions.
