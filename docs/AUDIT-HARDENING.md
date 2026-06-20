# Audit hardening — what changed

This pass implemented the findings from the deep audit on `feat/audit-hardening`.
typecheck (`npm run typecheck`), lint (`npm run lint`), and unit tests
(`npm test`) all pass. `next build` could not be run in the dev sandbox because
Google Fonts (`next/font/google` in `app/layout.tsx`) is network-blocked there;
it is now part of CI, which runs on infra that can reach Google Fonts.

## Implemented

**Security**
- Enforced CSP for the inline-independent directives (`base-uri`, `object-src`,
  `frame-ancestors`, `form-action`) alongside the existing Report-Only policy —
  `next.config.ts`. (Full `script-src` nonce migration still pending.)
- Trusted client IP for rate limiting: prefer `x-real-ip`, else the **rightmost**
  `x-forwarded-for` entry (was the spoofable leftmost) — `lib/rate-limit.ts`.
- Rate-limited the sign-up server action (`signup:${ip}`) — `lib/user/auth-actions.ts`.
- SSRF guard (`lib/security/safe-fetch.ts`, `safeAssetFetch`) on all server-side
  asset fetches: GLB rehost (`lib/admin/jewelry-generation-actions.ts`,
  `app/api/cron/poll-jobs/route.ts`) and the blob proxy
  (`app/api/jewelry-glb/_lib/stream-blob.ts`). Blocks non-HTTPS, credentials, and
  loopback/private/link-local/metadata targets.
- Rate limiter now logs (not silently) when it fails open — `lib/rate-limit.ts`.

**Observability**
- Central logger + error reporter (`lib/observability/logger.ts`), client beacon
  (`lib/observability/report-client.ts`), and sink route (`app/api/monitoring`).
  Wired into all three error boundaries and the booking / cron / telegram catch
  blocks. Best-effort forwards to `MONITORING_WEBHOOK_URL` when set; always logs
  structured output. Removed the false "we already know about this error" copy.

**Data layer**
- `prisma migrate` adopted: baseline `prisma/migrations/0_init` (schema + the
  out-of-band slot EXCLUDE constraint), `db:migrate` / `db:migrate:deploy`
  scripts. See `docs/prisma-migrations.md`.
- `take: 500` cap on the admin jewelry list; `maxDuration` on the expiry cron;
  `deleteJewelry` now refuses pieces with booking history with a friendly banner
  instead of a 500; Neon pool guidance in `.env.example`.

**Next.js / performance**
- `React.cache()` dedup on the four dynamic detail pages (metadata + body shared
  one query); `Promise.all` on the account telegram-link path.
- `JewelryShowcase` + `account/feed/parts` switched from full `motion` to `m`;
  `@react-three/postprocessing` added to `optimizePackageImports`.
- Catalog GLBs preload on card hover/focus so first try-on doesn't stall —
  `components/catalog/cards/SlotCard.tsx`.

**Accessibility**
- `InspectOverlay` is now a real dialog: `role="dialog"`, `aria-modal`,
  `aria-label`, Tab focus-trap, scroll lock, focus restore.
- `aria-label`s on icon-only equip/unequip controls + the catalog rail search;
  sub-32px hit targets enlarged.

**Dead code / docs**
- Deleted orphaned sprite-upload cluster, `components/scene/BodyModel.tsx`, the
  catalog variant components (`CardsRadial`, `CardsSheet`, `EnvHoloVoid`,
  `EnvAtelierSpotlight`, `EnvNeonArena`) and their dead dispatcher branches, the
  inert `loader-preview` affordance, and the `RailDetail` editorial/sheet layouts.
- Marked the rerender/scale docs historical (React Compiler handles memoization)
  and flagged the stale `/catalog` section of `05-page-map.md`.

**Tooling / tests**
- `engines` + `.nvmrc`; pinned `next-auth` and `react-doctor` to exact versions;
  ESLint `no-unused-vars` → error + type-aware `no-floating-promises` on routes.
- `next build` added to CI.
- New tests: `tests/booking-schema.test.ts` (extracted to
  `lib/booking/booking-schema.ts`), `tests/safe-fetch.test.ts`,
  `tests/settings-schema.test.ts`, plus a gated integration scaffold
  (`tests/booking.integration.test.ts`). 35 passing, 6 `todo`.

## Deferred (with rationale)

- **`noUncheckedIndexedAccess`** — enabling it surfaced 312 errors (158 in
  `lib/admin/glb-normalize.ts` geometry math). Per the audit's own guidance this
  should be adopted incrementally; ramming in non-null assertions across geometry
  math would reduce safety. Do it module-by-module later.
- **/about cross-request caching (nextjs-1)** — needs `settings` + `reviews` tag
  infrastructure; getting invalidation wrong would show admins stale content.
  Left `force-dynamic` (correct + safe).
- **Landing `frameloop` viewport gating (perf-4)** — the scene is a fixed,
  scroll-driven storyboard the authors deferred pending visual QA; the tab-hidden
  pause already covers the main win.
- **Interactive detail thumbnails (a11y-5)** — `DetailShowcase` is a server
  component; would need a client island. Photos + spec ledger already convey the
  info and booking is unaffected.
- **Catalog prop-union pruning (architecture-2)** — removing the dead design-axis
  props cascades through the whole tree; the shipping dead *components* were
  removed, the unused type members are harmless.
- **husky / lint-staged + GLB-math unit tests + jewelry/content schema tests** —
  husky needs a lockfile-changing install; the rest follow the patterns above.

## Required follow-ups (cannot be done from code)

1. **Baseline production for migrations** (one-time): `npx prisma migrate resolve
   --applied 0_init` against prod, then set the Vercel build command to
   `prisma migrate deploy && next build`. See `docs/prisma-migrations.md`.
2. **Set `MONITORING_WEBHOOK_URL`** in the deploy env to actually receive error
   events (Slack/Discord/relay). Without it, errors still log to stdout/stderr.
