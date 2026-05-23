# 02 — Requirements

## Functional

- 3D fitting on a generic full-body model split into regions: `HEAD` (ears, face), `TORSO` (nipples, navel), `OTHER` (hip, ankle, surface piercings).
- User picks region → anchor lights up → picks anchor → preset cameras kick in + limited drag (±15–20°). **No free orbit.**
- **Multi-jewelry try-on**: user can place multiple jewelries on different anchors simultaneously — one piece per anchor — to preview a complete look. A tray UI lists currently fitted pieces and allows add / remove / reassign. Soft cap of 6 simultaneous pieces.
- Storytelling landing page:
  - Hero → Chapter 1 (6 featured jewelries) → Chapter 2 (pick anchor on 3D model) → Chapter 3 (book).
  - User can break out at any chapter into normal browsing.
- Public pages: Home (storytelling), About, Services (prices visible), Catalog, Gallery, Book, FAQ, Contact.
- Guest booking: name + email + phone; **no account required**. Optional account for booking history.
- Soft reservation on jewelry: `Jewelry.inStock` decrements when a booking is placed.
- Jewelry booking and appointment booking are independent but linkable in a single combined flow. **Multiple jewelries can be booked together and linked to a single appointment** (one `Appointment` ─< many `JewelryBooking` rows).
- Admin manually publishes / edits / deletes time slots at any time.
- Auto-3D pipeline: admin uploads 1–4 photos → Tripo3D API → `.glb` produced → admin reviews → approve / regenerate / upload manual `.glb`. A dry-run mode lets the team exercise the full flow without burning credits during development.
- Email confirmations (Resend) to user + admin; Telegram bot alerts admin instantly.
- Admin panel manages: jewelry, anchor points (seeded), time slots, bookings, appointments, site content (About, Services, FAQ, Gallery), and settings.

## Non-functional

- **Russian-language UI throughout** — public site and admin panel.
- **Responsive, mobile-first** — works on mid-range phones from the last 5 years.
- **3D scene optimized**: Draco-compressed meshes, KTX2 textures, baked lighting, no realtime shadows.
- **WebGL2 capability check** with a graceful Russian fallback message (`Устройство не поддерживается`) on unsupported devices.
- **Hosted on Vercel**, database on **Neon**, assets on **Vercel Blob**.
- **No automated tests, no e2e** (per user request).

## Out of scope (Phase 2 / future)

- React Native mobile app — will reuse the API and embed the web 3D viewer in a `WebView`.
- Photo-upload "lite mode" — 2D AR fallback for low-end devices using face landmarks (e.g., MediaPipe).
- Self-hosted 3D generation (TripoSR / Hunyuan3D-2) for cost control.
- Payments.
- Multi-piercer / multi-studio support.
