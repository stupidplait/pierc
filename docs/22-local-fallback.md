# 22 — Local self-hosted 3D fallback (credit-zero)

> Phase 2 follow-up. The fallback that takes over when the paid providers
> (Replicate, Tripo3D) run out of credits — generation runs on **owned
> hardware** instead of failing.
>
> **Status:** ⬜ **seam only.** The provider stub and auto-chain wiring exist;
> the actual worker is deferred until a GPU + local model is chosen.

## Goal

When Replicate and Tripo3D are both exhausted or unconfigured, a
"Сгенерировать 3D" click should fall through to a self-hosted generator
rather than dead-end — at **zero marginal cost**, by reusing a machine we
already own.

## What's wired today (the seam)

- `ProviderId` includes `"local"` ([types.ts](../lib/three-gen/types.ts)).
- [`local.ts`](../lib/three-gen/local.ts) is a stub provider:
  - `isAvailable()` is gated on `LOCAL_3D_WORKER=1` — **off by default**, so
    the live auto-chain behaves exactly as before.
  - `start()` / `poll()` return an explicit "not implemented" until the
    worker is built (no silent hangs).
- It sits at the **tail** of `AUTO_PRIORITY`
  (`replicate → tripo3d → local`) in [index.ts](../lib/three-gen/index.ts),
  so the fallthrough order is already correct — the chain will reach `local`
  automatically once it's enabled and implemented.

That means finishing this feature is purely "build the worker + implement
the two methods + flip `LOCAL_3D_WORKER=1`" — no surgery on the pipeline,
the cron, or the admin UI.

## Intended architecture — pull-based worker

The constraint that shapes everything: the generator needs a GPU, lives on a
home/studio machine behind a router (no public inbound), and must stay free.
So the worker **pulls** work rather than receiving pushes.

```
Vercel (Next.js + Prisma)                    ← unchanged, free
  start(): credits==0 → GenerationJob{ provider:'local', status:'QUEUED' }
                                   │
        ┌──────────────────────────┘   (no external API call to start)
        ▼
  Your machine (GPU) runs a small loop that PULLS:
    1. POST /api/local-jobs/claim   (Bearer LOCAL_WORKER_SECRET)
         → atomically claims oldest QUEUED local job, marks PROCESSING,
           returns { jobId, inputPhotos }
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

- [ ] Pick the local model + runtime (TripoSR / InstantMesh / Stable-Fast-3D).
- [ ] `start()` in `local.ts`: insert/return a claimable job instead of the
      stub error. (Decide: reuse `GenerationJob` as-is — likely yes, no
      schema change — vs. add a `claimedAt`/`workerId` column for locking.)
- [ ] `POST /api/local-jobs/claim` — atomic claim (e.g.
      `UPDATE … WHERE status='QUEUED' … RETURNING` or a row lock) behind a
      `LOCAL_WORKER_SECRET` bearer.
- [ ] `POST /api/local-jobs/[id]/result` — accept the `.glb`, re-host on
      Blob (reuse the `rehostGlb` logic), set terminal status.
- [ ] `poll()` in `local.ts`: read the job row's status back.
- [ ] Worker script (Node or Python) running the claim→generate→upload loop.
- [ ] Set `LOCAL_3D_WORKER=1` + `LOCAL_WORKER_SECRET` once the above runs.

## Note on scale

The model `glbScale` field on `Jewelry` already exists precisely because
AI-generated meshes arrive at unknown scale (see the schema comment). The
local path should set/expose `glbScale` the same way the Tripo3D path does.
