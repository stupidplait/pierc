# 22 — Local self-hosted 3D fallback (credit-zero)

> Phase 2 follow-up. The fallback that takes over when the paid providers
> (Replicate, Tripo3D) run out of credits — generation runs on **owned
> hardware** instead of failing.
>
> **Status:** 🟡 **server side built; GPU worker deferred.** The `local` provider
> (real `start`/`poll`), the claim + result API endpoints, and the auto-chain
> wiring all exist. Only the GPU worker script that drives them is left to run —
> it needs a model + a machine (see "To build later"). Everything stays gated on
> `LOCAL_3D_WORKER=1` (off by default), so the live flow is unchanged until then.

## Goal

When Replicate and Tripo3D are both exhausted or unconfigured, a
"Сгенерировать 3D" click should fall through to a self-hosted generator
rather than dead-end — at **zero marginal cost**, by reusing a machine we
already own.

## What's built today (server side)

- [`local.ts`](../lib/three-gen/local.ts) is a **real provider**, gated on
  `LOCAL_3D_WORKER=1` (off by default):
  - `start()` mints a claimable `providerJobId` (`local:queued:<uuid>`) with NO
    external call. The caller stores it on a normal `GenerationJob` row
    (status `PROCESSING`), exactly like any provider — no schema change.
  - `poll()` reads the row's status; finalization happens in the result endpoint,
    so the poll loop only ever sees a local job as "still processing" (or FAILED).
- [`POST /api/local-jobs/claim`](../app/api/local-jobs/claim/route.ts) — Bearer
  `LOCAL_WORKER_SECRET` (fail-closed). Atomically claims the oldest unclaimed
  local job via a **compare-and-swap on its providerJobId**
  (`local:queued:*` → `local:run:*`), so two workers never grab the same job and
  no `claimedAt` column is needed.
- [`POST /api/local-jobs/[id]/result`](../app/api/local-jobs/[id]/result/route.ts)
  — accepts a multipart `glb` file (or an `error` string), runs the SAME
  `optimizeGlb` + type-driven normalize (attach injection + Gemini tiebreaker +
  quality gate) as the managed providers, re-hosts on Vercel Blob, and finalizes
  the job directly (SUCCEEDED + jewelry PENDING_REVIEW).
- It sits at the **tail** of `AUTO_PRIORITY` (`replicate → tripo3d → local`) in
  [index.ts](../lib/three-gen/index.ts), so the chain reaches `local` only after
  the paid providers are exhausted.

That means finishing this feature is purely "run a GPU worker that calls the two
endpoints + flip `LOCAL_3D_WORKER=1`" — no further surgery on the pipeline, the
cron, or the admin UI.

## Intended architecture — pull-based worker

The constraint that shapes everything: the generator needs a GPU, lives on a
home/studio machine behind a router (no public inbound), and must stay free.
So the worker **pulls** work rather than receiving pushes.

```
Vercel (Next.js + Prisma)                    ← unchanged, free
  start(): chain reaches local → GenerationJob{ provider:'local',
           status:'PROCESSING', providerJobId:'local:queued:<uuid>' }
                                   │
        ┌──────────────────────────┘   (no external API call to start)
        ▼
  Your machine (GPU) runs a small loop that PULLS:
    1. POST /api/local-jobs/claim   (Bearer LOCAL_WORKER_SECRET)
         → atomically claims the oldest unclaimed local job via a
           compare-and-swap on its providerJobId (local:queued:* → local:run:*);
           returns { id, jewelryId, providerJobId, photoUrls }
    2. download photo → run local model (TripoSR / InstantMesh /
       Stable-Fast-3D) → produce .glb
    3. POST /api/local-jobs/<id>/result  (multipart .glb, or a URL)
         → server re-hosts on Vercel Blob, sets job SUCCEEDED +
           jewelry PENDING_REVIEW  (same terminal state as the cron path)
```

Because the worker reaches *out*, there's no inbound networking, no
always-on paid host — it's free by reusing hardware. Jobs simply sit
`QUEUED` while the machine is off and drain when it wakes; the admin UI
already shows that naturally via the existing PROCESSING/queued panel.

### Why pull, not push
- No public address or port-forwarding on the home machine.
- Survives the machine being asleep — work queues durably in Postgres.
- One claim endpoint is the entire server-side surface.

## To build later (checklist)

- [x] `start()` / `poll()` in `local.ts` — claimable job id + status read-back
      (reuses `GenerationJob` as-is, no schema change; the CAS on `providerJobId`
      is the lock).
- [x] `POST /api/local-jobs/claim` — atomic compare-and-swap claim behind a
      `LOCAL_WORKER_SECRET` bearer.
- [x] `POST /api/local-jobs/[id]/result` — accept the `.glb`, re-host +
      `optimizeGlb` (with type-driven normalize), set the terminal status.
- [x] **Worker script** — [`scripts/local-worker/`](../scripts/local-worker/)
      (`worker.mjs` + `README.md` + `generate_triposr.py`): a dependency-free Node
      claim→download→generate→result loop with TWO backends — `GENERATOR=fal`
      (managed, no GPU, runnable immediately) or `GENERATOR=command` (your own
      GPU model via TripoSR / SF3D / TRELLIS) for true credit-zero.
- [ ] **Run it** (deployment): pick the model/host — fal.ai now, or TripoSR/SF3D/
      TRELLIS on your Windows GPU (free, PC on) or Modal serverless ($30/mo free
      credits, scale-to-zero) — set the env (see the README), run the worker, and
      flip `LOCAL_3D_WORKER=1` + `LOCAL_WORKER_SECRET`.

## Note on scale

The model `glbScale` field on `Jewelry` already exists precisely because
AI-generated meshes arrive at unknown scale (see the schema comment). The
local path should set/expose `glbScale` the same way the Tripo3D path does.
