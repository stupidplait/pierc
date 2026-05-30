# 18 — Managed 3D Generation via Replicate

> Phase 2 work stream 4. The trimmed-down "self-hosted 3D generation"
> sketch from [`13-phase-2.md`](./13-phase-2.md) — managed inference
> instead of literal self-hosting, because the per-piece volume
> doesn't justify operating a GPU server.
>
> **Status legend:** ✅ done · 🟡 partial · ⏸ paused · ⬜ not started.

A second `ThreeGenProvider` implementation backed by
[Replicate](https://replicate.com/) running Tencent's
**Hunyuan3D-2**. Slots into the existing provider abstraction (see
[`08-auto-3d-pipeline.md`](./08-auto-3d-pipeline.md)) as the new
*primary* auto provider, with Tripo3D demoted to the fallback slot
and `manual` still available as the always-free quality override.

## Problem statement

Tripo3D works, but charges per task — each `Сгенерировать 3D` click
is metered, and per-call pricing on the auto-3D path scales linearly
with admin churn. Replicate hosts the same class of image-to-model
checkpoints (Hunyuan3D-2, TripoSR, MeshAnything, etc.) on pay-per-
second GPU compute that's 10–50× cheaper per generation, with no
per-piece licensing or vendor lock-in.

The original Phase 2 sketch labelled this stream "self-hosted 3D
generation" with a dedicated GPU VPS in mind. At this studio's
scale (~1–2 new pieces per month outside the parametric Blender
pipeline), running a Linux+CUDA server with model weights, restarts,
and monitoring would cost more in ops time than it saves in inference
fees. **Managed inference matches the spec's intent** (escape
Tripo3D's per-task pricing, swap in our own model choice) without
the operational baggage.

## Scope

### In v1

- **New provider** `lib/three-gen/replicate.ts` — same `Provider`
  interface as `tripo3d.ts` (`isAvailable` / `start` / `poll`).
- **Hunyuan3D-2 as the default model.** Higher-fidelity than TripoSR
  on jewelry shapes; ~30–60 s per generation on Replicate's GPUs;
  ~$0.01–0.05 per call. Configurable via `REPLICATE_MODEL` env var so
  you can swap to TripoSR / MeshAnything / a future Hunyuan3D-2.1
  release without code changes.
- **Provider chain:** `["replicate", "tripo3d"]`. Replicate becomes
  the auto primary. If `REPLICATE_API_TOKEN` is missing OR a
  generation fails, the chain falls through to Tripo3D unchanged.
  Manual upload remains the always-free quality override.
- **Dry-run support** — same `DRY_RUN_3D_GEN=1` switch as Tripo3D.
  Returns the Khronos `Avocado.glb` sample so the rehost + admin-
  review UI can be exercised at zero cost.
- **Same admin UX** — visitor and admin flows are unchanged.
  Generation still produces a `GenerationJob(PROCESSING)` row, the
  cron poller (or admin's `Обновить статус` button) advances it, and
  approved models still re-host to Vercel Blob before being attached
  to `Jewelry.glbUrl`. Only the `provider` column on
  `GenerationJob` differs (`"replicate"` instead of `"tripo3d"`).

### Phase B (May 2026): single-anchor restriction

After the multi-anchor jewelry rollout (see
[`docs/20-multi-anchor-jewelry.md`](./20-multi-anchor-jewelry.md)), AI
generation is **restricted to single-anchor types** — `STUD` and `RING`
only. Multi-anchor types (`BARBELL`, `CIRCULAR_BARBELL`, `ORBITAL`,
`CHAIN_LADDER`) require precise endpoint placement that AI can't reliably
produce; admin must use the parametric Blender pipeline (see
[`docs/14-jewelry-pipeline.md`](./14-jewelry-pipeline.md)) or upload a
hand-modeled `.glb` for those.

Enforcement (defence in depth):

- **UI** — `<JewelryModelManager>` hides the auto-generation panel and
  shows the Russian hint `"Авто-генерация доступна только для
  одноточечных украшений…"` when `Jewelry.type` is multi-anchor.
- **Server** — `startJewelryGeneration` in
  `lib/admin/jewelry-generation-actions.ts` rejects multi-anchor types
  with a 4xx-equivalent `ActionState`, even if the form is bypassed.

AI-generated GLBs that DO ship (i.e. for STUD/RING) don't have
`attach:primary` empties — the renderer falls back to the legacy
"place mesh at anchor.position with anchor.rotation" path, which works
when the mesh's origin lands close to the post tip. A future improvement
(documented as "Future work" in 20-multi-anchor-jewelry.md) is an admin
3D point-picker that lets the admin tag `attach:primary` on AI output
before approval.

### Deliberately deferred

- **Literal self-hosted GPU VPS** — revisit only if monthly
  generations push past Replicate's break-even (~500–1000 calls/mo
  for a Lambda Labs / RunPod dedicated GPU). Today's volume is
  nowhere near.
- **A/B side-by-side comparison UI** — admin can already see the
  generated GLB in `<JewelryGenerationActions>` and reject + retry
  via the chain. A formal "compare Replicate vs Tripo result side
  by side" view would be polish past the cost-saving goal.
- **Replicate fine-tuning** — running our own fine-tuned LoRA on
  jewelry images is interesting but past v1.
- **Streaming progress updates** — Replicate exposes a webhook +
  prediction stream; for now we keep polling on the existing
  2-minute Vercel Cron + admin-button cadence. Reassess if cold-
  start latency becomes a UX issue.

## Architecture

```mermaid
flowchart LR
  subgraph Admin
    Edit[/admin/jewelry/&lt;id&gt;/edit/]
    Btn[\u00abСгенерировать 3D\u00bb]
  end

  subgraph Server
    Action[startJewelryGeneration]
    Pick[pickAutoProvider]
    Replicate[(replicate.ts)]
    Tripo[(tripo3d.ts)]
    Manual[(manual.ts)]
  end

  subgraph External
    RC[Replicate API<br/>Hunyuan3D-2]
    TC[Tripo3D API]
  end

  Edit -- click --> Btn -- POST --> Action
  Action --> Pick
  Pick -- "1) replicate.isAvailable()?" --> Replicate
  Pick -- "2) tripo3d.isAvailable()?" --> Tripo
  Replicate -- "POST predictions" --> RC
  Tripo -- "POST task" --> TC
  Replicate -- "providerJobId" --> DB[(GenerationJob.PROCESSING)]
  Tripo -- "providerJobId" --> DB

  Cron[/api/cron/poll-jobs/] -. every 2 min .-> Pick
  Pick -- "poll() by row.provider" --> DB
```

Failure of the primary triggers `pickNextAutoProvider("replicate")`,
which returns the next available provider in the chain (Tripo3D when
its key is set; otherwise null). The existing
`startJewelryGeneration` server action already walks this chain on
failure — no change needed beyond putting Replicate at the head.

## Provider implementation

`lib/three-gen/replicate.ts`:

```ts
const BASE_URL = "https://api.replicate.com/v1";

isAvailable() = isDryRun() || Boolean(REPLICATE_API_TOKEN);

start(input) {
  if (dryRun) return { providerJobId: "dry-run-…" };
  POST /v1/predictions
    { version: REPLICATE_MODEL,
      input: { image: photoUrls[0], …optional Hunyuan params } }
  → { id: string, status: "starting", … }
  return { providerJobId: id };
}

poll(id) {
  if (dryRun) return SUCCEEDED + Khronos sample
  GET /v1/predictions/<id>
  status one of: starting | processing | succeeded | failed | canceled
  succeeded → return SUCCEEDED + extract glb URL from output
  failed | canceled → FAILED
  else → PROCESSING
}
```

Output extraction handles three shapes (Replicate models vary):
- `output: "https://..."` — direct URL
- `output: ["https://...", ...]` — array (first .glb wins)
- `output: { mesh: "https://..." }` or similar — object with a string field

## Environment variables

Two new env vars, both documented in `.env.example`:

| Variable | Required | Notes |
|---|---|---|
| `REPLICATE_API_TOKEN` | yes (or omit to use Tripo3D fallback) | Get from https://replicate.com/account/api-tokens |
| `REPLICATE_MODEL` | yes | Format: `owner/name:version-hash`. Default suggested: `tencent/hunyuan3d-2:<latest-hash>`. Pin to a specific hash for reproducibility — bumping the hash is a deliberate decision. |

`DRY_RUN_3D_GEN=1` continues to short-circuit both providers.

## Cost notes

Rough numbers as of current pricing:

| Path | Cost / generation | Notes |
|---|---|---|
| Tripo3D (existing) | ~$0.20–2.00 depending on tier | Fixed per task |
| **Replicate + Hunyuan3D-2** | **~$0.01–0.05** | Pay per second (~30–60 s × ~$0.0008/s on T4 / A40 GPUs) |
| Self-hosted Lambda L4 | ~$0.50/hour ≈ $360/mo flat | Break-even vs Replicate at ~7000 generations/month |

At 1–2 admin-driven generations per month, Replicate costs ~$0.05/yr.

## Task list

### Task 1: Documentation ✅

This file. Plus the back-reference in
[`13-phase-2.md`](./13-phase-2.md). No application code changes.

### Task 2: lib/three-gen/replicate.ts + register in chain ✅

Create the new provider module mirroring `tripo3d.ts`'s shape. Add
`"replicate"` to `ProviderId`. Wire it into `all` + `AUTO_PRIORITY`
at the head of the chain. Update `getProviderStatus()` to expose the
new flag. Verify `pickAutoProvider` + `pickNextAutoProvider` walk
the chain correctly with both keys set.

**Demo:** with `REPLICATE_API_TOKEN` set, admin clicks
`Сгенерировать 3D` → `GenerationJob.provider="replicate"` →
poll → succeeds → admin approves → published.

**Implementation notes:**
- [`lib/three-gen/replicate.ts`](../lib/three-gen/replicate.ts)
  (~270 lines) mirrors the Tripo3D adapter shape. Key differences:
  Replicate auth uses `Authorization: Token <token>` (not Bearer);
  POST goes to either `/v1/predictions` (with `version` in body) or
  `/v1/models/{owner}/{name}/predictions` (no version); polling is
  `GET /v1/predictions/{id}`.
- `parseModel()` accepts three env-var formats so admins can
  copy-paste whatever Replicate's model page shows: bare hash,
  `owner/name:hash` (recommended for pinning), or `owner/name`
  (latest). Returns either `{ kind: "version", version }` for the
  pinned path or `{ kind: "slug", slug }` for the latest path.
- `pickGlbUrl()` tolerates string / array / object output shapes —
  Replicate models vary. Common keys: `mesh_glb`, `mesh`, `glb`,
  `model`, `model_url`. Falls back to "any string in the output that
  looks like a `.glb` URL."
- Dry-run mode reuses the same `DRY_RUN_3D_GEN=1` switch and the
  same Khronos `Avocado.glb` sample as Tripo3D — full UI exercise
  at zero cost.
- `lib/three-gen/index.ts` rewritten to register
  `replicate: replicateProvider` in `all`, set
  `AUTO_PRIORITY = ["replicate", "tripo3d"]`, and surface
  `replicate` status in `getProviderStatus()`. The
  `pickNextAutoProvider("replicate")` chain naturally returns
  Tripo3D when its key is configured.
- `ProviderId` extended to `"replicate" | "tripo3d" | "manual"`.
- No call-site changes needed — `startJewelryGeneration`,
  `pollJewelryJob`, and the cron route already walk `pickAuto…` /
  `pickNextAuto…` and read `getProvider(job.provider)` to dispatch
  per-row.

### Task 3: Wire replicate into the chain + env scaffolding ✅

This was tightly coupled to Task 2 — the chain wiring landed there.
Remaining bits:

- `.env.example` extended with the `REPLICATE_API_TOKEN` and
  `REPLICATE_MODEL` blocks, plus a clarifying note on the Tripo3D
  block about its new fallback role.
- The admin UI (`<JewelryGenerationActions>`) reads
  `getProviderStatus()` and surfaces "Авто-генерация недоступна"
  when no auto provider is configured. With either Replicate or
  Tripo set, the existing UI keeps working — no copy or markup
  changes needed in v1. Admins see Replicate-generated rows with
  `provider: "replicate"` in `GenerationJob`.

**Demo:** with `REPLICATE_API_TOKEN` + `REPLICATE_MODEL` set in
`.env`, admin clicks `Сгенерировать 3D`, the resulting
`GenerationJob` row carries `provider="replicate"` and Replicate's
prediction id. Removing those env vars (or setting only Tripo's)
falls back transparently to Tripo3D.

### Task 4: Update existing docs + README ✅

- Update [`08-auto-3d-pipeline.md`](./08-auto-3d-pipeline.md) to
  reflect the new chain (Replicate primary, Tripo3D fallback).
- Update README's deployment-checklist + smoke checklist with the
  Replicate setup steps.
- Mark this task ✅ + the others.

**Implementation notes:**
- `docs/08-auto-3d-pipeline.md`: provider-abstraction snippet now
  shows the three-way `ProviderId` union; implementation list adds
  `replicate.ts` ahead of `tripo3d.ts`; provider comparison table
  updated with Replicate (Hunyuan3D-2) as the current primary and
  Tripo3D as the current fallback; v1 decision paragraph carries a
  Phase 2 update note pointing to this doc; dry-run section now
  covers both providers explicitly.
- `README.md`:
  - tech-stack one-liner adds "Replicate (Hunyuan3D-2)" before
    Tripo3D
  - "Auto-3D pipeline" status bullet rewritten to reflect the new
    chain
  - "External services" table swaps in a Replicate row above Tripo3D
    and labels Tripo3D as "(fallback)"
  - "Environment variables" table adds `REPLICATE_API_TOKEN` and
    `REPLICATE_MODEL` rows; Tripo's row clarifies it's now the
    fallback
- The dev/prod activation step is just adding the two new env vars;
  no schema migration, no script to run.

## Risks & open questions

- **Replicate model deprecation.** Hunyuan3D-2 is on Replicate
  today; if Tencent or the maintainer pulls the model, the
  `REPLICATE_MODEL` env var lets us swap without redeploy. We pin
  a specific version hash to avoid silent regressions.
- **Cold-start latency** — Replicate boots a GPU on demand. First
  call after a quiet period can be 30–90 s; warm calls are 30–60 s.
  Acceptable in our async PENDING_REVIEW flow.
- **Output format drift** — Replicate models occasionally change
  their output shape (string vs array vs object). The extraction
  helper handles all three; if a future model returns something
  weirder, we either adapt the extractor or pick a different
  `REPLICATE_MODEL`.
- **Quality vs Tripo3D** — Hunyuan3D-2 is generally on par or
  better for jewelry per published comparisons, but you're the
  judge: rejected generations fall back to Tripo3D automatically
  via the chain, and `manual` is always available.
- **Non-jewelry inputs** — admin can still try the auto-3D button
  on weird inputs. Replicate's failure modes (timeouts, OOM) are
  surfaced as `FAILED` jobs the same way Tripo's are.
