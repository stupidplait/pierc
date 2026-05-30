# Specification — 3D Piercing Studio Web App

This folder contains the full specification for the project. Read it in order; each document builds on the ones before it.

## Recommended reading order

1. [`01-overview.md`](./01-overview.md) — Problem statement, goals, scope
2. [`02-requirements.md`](./02-requirements.md) — Functional and non-functional requirements
3. [`03-architecture.md`](./03-architecture.md) — Tech stack, high-level architecture, deployment
4. [`04-data-model.md`](./04-data-model.md) — Prisma schema and ERD notes
5. [`05-page-map.md`](./05-page-map.md) — Public + admin routes and what each page does
6. [`06-flows.md`](./06-flows.md) — Booking, scheduling, and auto-3D state diagrams
7. [`07-3d-fitting.md`](./07-3d-fitting.md) — 3D viewer, anchors, preset cameras, mobile performance
8. [`08-auto-3d-pipeline.md`](./08-auto-3d-pipeline.md) — Photo → 3D model pipeline & provider abstraction
9. [`09-admin-panel.md`](./09-admin-panel.md) — Admin features and screens
10. [`10-content-strategy.md`](./10-content-strategy.md) — Russian copy, storytelling landing, CMS content
11. [`11-folder-layout.md`](./11-folder-layout.md) — Proposed Next.js project structure
12. [`12-tasks.md`](./12-tasks.md) — Implementation roadmap (15 demoable tasks)
13. [`13-phase-2.md`](./13-phase-2.md) — React Native, photo-upload lite mode, future work
14. [`14-jewelry-pipeline.md`](./14-jewelry-pipeline.md) — Parametric Blender pipeline (jewelry GLBs)
15. [`15-lite-mode.md`](./15-lite-mode.md) — Photo-upload "lite mode" try-on
16. [`16-reviews.md`](./16-reviews.md) — Customer reviews + magic-link flow
17. [`17-seo.md`](./17-seo.md) — Per-page metadata, sitemap, JSON-LD
18. [`18-replicate-3d.md`](./18-replicate-3d.md) — Replicate (Hunyuan3D-2) AI generation
19. [`19-mobile-app.md`](./19-mobile-app.md) — React Native WebView wrapper
20. [`20-multi-anchor-jewelry.md`](./20-multi-anchor-jewelry.md) — **Phase B (May 2026):** multi-anchor jewelry system (industrial bars, orbital rings, etc.); JewelryType enum, JewelryAnchorBinding junction table, attach:* empties, renderer math

## How to read

- **For a quick orientation:** read 01, 02, 03.
- **For backend/data work:** focus on 04, 06, 08.
- **For frontend/UX work:** focus on 05, 07, 10.
- **For project planning:** read 12 in full.
- **All UI copy is in Russian.** Russian phrases throughout these docs are wrapped in backticks because they are the actual UI strings (e.g., `Запись на услугу`).
