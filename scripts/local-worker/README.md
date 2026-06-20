# Local 3D-generation pull-worker

The credit-zero fallback generator for the auto-3D pipeline. Runs on a machine you
own, reaches **out** to the deployed app (no public inbound / port-forwarding),
claims queued `local` generation jobs, builds a `.glb`, and posts it back. See
[`docs/22-local-fallback.md`](../../docs/22-local-fallback.md) for the architecture.

## Prerequisites (app side)

1. Set `LOCAL_WORKER_SECRET` in the app's env (any long random string).
2. Set `LOCAL_3D_WORKER=1` so the `local` provider joins the auto chain tail
   (`replicate → tripo3d → local`).
3. Redeploy. Now when the paid providers are exhausted/unconfigured, a
   `Сгенерировать 3D` click queues a `local` job for this worker to pick up.

## Run the worker

Node 18+ (built-ins only — no `npm install`):

```bash
# Common config
export APP_URL="https://your-app.vercel.app"
export LOCAL_WORKER_SECRET="<same as the app>"

# Option A — managed (easiest, NO GPU; not strictly zero-cost). Exercises the whole
# pipeline immediately via fal.ai. ~cents/run; ~$20 signup credit.
export GENERATOR=fal
export FAL_KEY="<https://fal.ai/dashboard/keys>"
# export FAL_MODEL="fal-ai/trellis"   # optional; default fal-ai/triposr
node scripts/local-worker/worker.mjs

# Option B — TRUE credit-zero on your own GPU (TripoSR / SF3D / TRELLIS).
export GENERATOR=command
export GENERATE_CMD="python scripts/local-worker/generate_triposr.py {in} {out}"
export TRIPOSR_DIR="/path/to/TripoSR"   # used by the reference Python wrapper
node scripts/local-worker/worker.mjs
```

`{in}` is the downloaded input photo, `{out}` is the `.glb` the command must write.
Any "image → .glb" CLI works; the bundled `generate_triposr.py` is a thin wrapper
around TripoSR's `run.py` that normalizes the output path.

## What happens to the result

The worker POSTs the `.glb` to `POST /api/local-jobs/<id>/result`, which runs the
**same** `optimizeGlb` + type-driven normalize as the managed providers (attach
injection for STUD/RING/BARBELL, Gemini tiebreaker/quality gate when configured),
re-hosts it on Vercel Blob, and moves the piece to `PENDING_REVIEW` for the admin to
approve — identical to a Replicate/Tripo result.

## Model & hosting notes

- **TripoSR** (MIT, ~6 GB VRAM, sub-second) — easiest local model; lower fidelity,
  vertex-colour only (weak on shiny metal). Good first pass.
- **Stable-Fast-3D** (free < $1M revenue, ~7 GB) — UV textures + material params;
  better for jewelry. Same `GENERATE_CMD` shape.
- **TRELLIS** (MIT, ~16 GB) — highest quality of the self-hostable set.
- No GPU at home? Use **Option A (fal.ai)** now, or deploy the model on **Modal**
  (scale-to-zero, $30/mo free credits) and point `GENERATE_CMD` at a small client
  that calls your Modal endpoint.

Jobs queue durably in Postgres while this worker is offline and drain when it wakes.
