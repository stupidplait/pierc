# 01 — Overview

## Problem Statement

A solo piercer needs a public website that doubles as a virtual jewelry try-on tool and a no-payment booking system. Visitors must be able to:

1. Try jewelry — one piece or several at once — on a realistic 3D body model.
2. Book jewelry pieces with a soft reservation.
3. Book appointments.
4. Do (2) and (3) together or independently.

The piercer (admin) needs a panel to manage jewelry, time slots, bookings, appointments, and site content. Adding new jewelry should be largely automated: the admin uploads photos, the system generates a `.glb` 3D model that becomes immediately fittable, with a manual override available for quality control. The whole site is in Russian. A React Native mobile app is planned for Phase 2.

## Goals

- Showcase jewelry interactively through a 3D try-on.
- Convert visitors into appointments and jewelry reservations with minimal friction (guest booking allowed — no required signup).
- Give the admin a single panel to run the studio.
- Make adding new jewelry nearly effortless via automated 3D generation, with manual fallback.

## Non-goals (v1)

- Online payments.
- Multi-piercer / multi-studio support.
- Automated tests, e2e tests.
- Native mobile app (planned for Phase 2).
- Self-hosted 3D generation (kept as a Phase 2 option).

## Audience for this spec

- The developer(s) implementing the app.
- The studio owner reviewing what will be built.
- Future contributors joining the project (e.g., for the React Native app).
