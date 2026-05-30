# 21 — Free recurring cron for 3D job polling

> Phase 2 follow-up. Makes auto-3D jobs advance on their own — both in the
> admin's open tab *and* while nobody is watching — without paying for
> Vercel Pro cron.
>
> **Status legend:** ✅ done · 🟡 partial · ⏸ paused · ⬜ not started.

## Problem

The 3D pipeline already has everything needed to advance a job
unattended:

- `/api/cron/poll-jobs` ([route](../app/api/cron/poll-jobs/route.ts)) polls
  every `PROCESSING` `GenerationJob`, applies the same transitions as the
  admin "Обновить сейчас" button, and re-hosts finished GLBs on Vercel Blob.
- It's authenticated: when `CRON_SECRET` is set it requires
  `Authorization: Bearer ${CRON_SECRET}` (open in dev when unset).

The only missing piece is something to *call* it on a short interval.
Vercel's `vercel.json` cron is capped at **once per day** on the Hobby
plan (`0 9 * * *`) — fine as a backstop, useless for "watch a 1–3 minute
generation finish."

Two layers solve this together:

| Layer | What it does | Lives where |
| --- | --- | --- |
| **Tab auto-refresh** | While a job is `PROCESSING` and the admin has the edit page open, `JobAutoRefresh` re-reads the page every ~5 s so the panel flips to "ready"/"failed" by itself. **Read-only** — it never mutates. | [`JobAutoRefresh.tsx`](../components/admin/JobAutoRefresh.tsx) ✅ |
| **External cron** | Hits `/api/cron/poll-jobs` every minute so jobs advance even with **no tab open**. This is the actual driver of provider polling + DB transitions. | cron-job.org (below) ⬜ setup |

Keeping "drive" (cron) separate from "display" (tab refresh) is deliberate:
only one actor mutates jobs, so the open tab can never race the cron into a
double re-host.

## Why cron-job.org (vs GitHub Actions)

Chosen for this project:

- **Sub-minute / 1-minute granularity.** GitHub Actions `schedule` is
  best-effort on a ~5-minute floor and is frequently delayed under load —
  too coarse for 1–3 minute jobs.
- **No CI coupling / no minutes burned.** It just pings a URL; nothing runs
  in the repo.
- **Free** for this volume, and it can send the exact `Authorization`
  header the route already checks.

GitHub Actions stays a reasonable alternative if you'd rather keep the
schedule in-repo and can tolerate coarser timing — the route is identical
either way.

## Setup (cron-job.org)

1. Create a free account at <https://cron-job.org>.
2. **Create cronjob** →
   - **Title:** `pierc — poll 3D jobs`
   - **URL:** `https://<your-app-domain>/api/cron/poll-jobs`
   - **Schedule:** every 1 minute (`* * * * *`), or every 2 minutes if you
     want to be gentle.
3. **Advanced → Headers**, add:
   - `Authorization: Bearer <the value of CRON_SECRET from your Vercel env>`
4. Save. Use **"Run now"** once and confirm a `200` with a JSON body like
   `{ "ok": true, "processed": 0, "results": [] }`.

> **Security:** the route refuses any request without the correct
> `Bearer ${CRON_SECRET}`. Make sure `CRON_SECRET` is set in the Vercel
> project env (Production + Preview) — generate with
> `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.
> If `CRON_SECRET` is **unset**, the route is open (dev mode) — never deploy
> to a public domain without it set.

## Interaction with `vercel.json`

Leave the existing daily Vercel cron in place — it's a harmless backstop
that drains anything cron-job.org might miss during an outage. No code
change is needed; the two simply both hit the same idempotent route.

## Verifying end-to-end

1. Set `DRY_RUN_3D_GEN=1` (free, no API calls) in the environment.
2. Open a STUD/RING jewelry's edit page, click **Сгенерировать 3D**.
3. Without touching anything, the panel should move PROCESSING → "ready to
   review" within a poll cycle or two:
   - With cron-job.org configured: works even if you close and reopen the
     tab.
   - With only the tab open: works while the tab stays open (the
     `JobAutoRefresh` ticker).

## Status

- ✅ `/api/cron/poll-jobs` route (auth'd, idempotent)
- ✅ `JobAutoRefresh` tab live-feedback
- ⬜ cron-job.org job created (manual, one-time — follow the steps above)
