# 13 — Phase 2 / Future Work

This document captures planned work that is intentionally **out of v1 scope**. Nothing here should be implemented during the 15-task roadmap; it exists to prevent future-pain decisions today and to give the architecture a clear direction.

## React Native mobile app

**Goal:** a native iOS + Android app that mirrors the web experience.

**Recommended approach:** Expo project that wraps the existing web 3D viewer in a `WebView`, with native screens for catalog browsing, booking, and account. The native screens reuse the existing Next.js Route Handler API (`/api/...`) — no duplicate backend.

**Why WebView for 3D:** maintaining two 3D implementations (web Three.js and `react-three-fiber/native`) is operationally expensive. The WebView reuses the production-ready 3D viewer with no extra maintenance.

**Alternative path (not recommended):** `expo-gl` + `react-three-fiber/native`. This would mean every 3D bug fix or feature is implemented twice. Only consider if WebView performance proves inadequate on target devices.

**Open question for Phase 2:** push notifications via Expo's notification service for booking confirmations and reminders.

## Photo-upload "lite mode"

**Goal:** a 2D fallback for devices that fail the WebGL2 check or render the 3D scene poorly.

**Approach:**
- User uploads a selfie (or uses the live camera).
- MediaPipe Face Landmarker (or similar) detects face landmarks.
- The chosen jewelry's photo is overlaid as a 2D sprite at the landmark location for the selected anchor.

**Quality tradeoff:** flatter than the 3D try-on but works on virtually any device.

**Schema impact:** likely none in v1 — jewelry photos already exist. May add a 2D anchor offset table later if precision needs tuning.

## Self-hosted 3D generation

**Trigger:** if monthly volume outgrows the Tripo3D budget, or if quality on jewelry-specific shapes lags.

**Approach:** swap the `ThreeGenProvider` implementation to a self-hosted model (TripoSR or Hunyuan3D-2) running on a GPU instance. Because the provider abstraction (see [`08-auto-3d-pipeline.md`](./08-auto-3d-pipeline.md)) is already in place, this is a config + new provider file, not a rewrite.

**Pros:** unlimited generations, no per-call cost.
**Cons:** GPU server cost (~$30–100/mo depending on GPU), ops overhead, cold-start latency.

## Payments

**If the studio later wants deposits or full payment:**
- Russian-friendly providers: YooKassa, CloudPayments, Tinkoff acquiring.
- International: Stripe.
- Schema impact: add `Payment` model linked 1-to-1 with `JewelryBooking` and/or `Appointment`. Booking flow gains an optional payment step before final confirmation.

## Multi-piercer / multi-studio

**If the business grows beyond one piercer:**
- Add `Studio` and `Piercer` entities.
- Make `AvailabilitySlot`, `Appointment`, `JewelryBooking` foreign-key to a `Piercer`.
- Admin scope per-studio (RBAC).

This is a breaking schema change; deferring until there is concrete demand.

## Analytics & SEO

**Future considerations once the site has traffic:**
- Plausible or PostHog for privacy-friendly analytics.
- Structured data (JSON-LD) for jewelry as `Product` and the studio as `LocalBusiness`.
- A sitemap and robots.txt generated from the catalog and content.

## Reviews & testimonials

If the studio wants to surface social proof:
- New `Review` model linked to a completed `Appointment`.
- Public moderation flow in admin (approve before showing).
- Display on `/about` and individual jewelry pages.
