# 08 — Auto-3D Pipeline

## Goal

Make adding a new jewelry as low-effort as possible: admin uploads a few photos, the system produces a `.glb` automatically, and after a quick admin review the jewelry becomes immediately available for 3D fitting.

## Provider abstraction

A small interface in `lib/three-gen/types.ts` hides the specific provider:

```ts
export interface Provider {
  id: ProviderId;                                  // "replicate" | "tripo3d" | "manual"
  isAvailable(): boolean;
  start(input: ProviderInput): Promise<StartResult>;
  poll(providerJobId: string): Promise<PollResult>;
}
```

Implementations live alongside it:
- `replicate.ts` — primary auto-generation provider (Hunyuan3D-2 by
  default, configurable). Managed inference; ~10–50× cheaper per
  generation than Tripo3D. See [`18-replicate-3d.md`](./18-replicate-3d.md).
- `tripo3d.ts` — fallback auto-generation provider. Was the v1
  primary; demoted in Phase 2 work stream 4 once Replicate landed.
- `manual.ts` — no-op symmetry adapter; the manual upload UI bypasses the GenerationJob table entirely (writes `Jewelry.glbUrl` directly).

`pickAutoProvider()` returns the first configured auto provider; `pickNextAutoProvider(after)` returns the next available one in the priority chain (`AUTO_PRIORITY = ["replicate", "tripo3d"]`). When Replicate is configured but a generation fails, the chain falls through to Tripo3D automatically; with both unconfigured, the auto-3D button is disabled and only manual upload works.

## Provider comparison (research summary)

| Approach | Cost model | Quality on jewelry | Ops cost |
|---|---|---|---|
| **Replicate (Hunyuan3D-2)** *(current primary)* | Pay-per-second compute (~$0.01–0.05 per generation) | On par with or better than Tripo3D H3 per published comparisons | ~zero — managed |
| **Tripo3D API** *(current fallback)* | Pay-per-task ($0.20–2.00 depending on tier) | Strong, PBR + textures via H3 model | ~zero — managed |
| Replicate-hosted alternatives (TripoSR, Stable Fast 3D, InstantMesh, MeshAnything) | Pay-per-second compute (~$0.005–0.02) | Lower than Hunyuan3D-2 / Tripo H3 | ~zero — managed; swap in via `REPLICATE_MODEL` env var |
| Self-hosted TripoSR / Hunyuan3D on a GPU VPS | Software is free; ~$30–150/mo flat compute | Same as Replicate | Linux server, docker, monitoring |
| Photogrammetry (Meshroom) | Free | Highest | Admin shoots 15–30 photos per item |

**v1 decision:** Tripo3D as the only configured auto provider, manual `.glb` upload as the always-free quality override. The provider abstraction is kept so swapping in / adding fallback providers later is a config change, not a rewrite.

**Phase 2 update (work stream 4):** Replicate added as the new auto
primary running Hunyuan3D-2 (~10–50× cheaper per generation than
Tripo3D); Tripo3D demoted to the fallback slot in `AUTO_PRIORITY`.
Manual upload remains the always-free quality override.
See [`18-replicate-3d.md`](./18-replicate-3d.md) for the full spec.

## Job lifecycle

```
DRAFT (jewelry created with photos but no glb)
  │  admin clicks "Сгенерировать"
  ▼
PROCESSING (GenerationJob.status = PROCESSING)
  │  admin clicks "Обновить статус"; provider returns SUCCEEDED
  │  GLB is downloaded and re-hosted on Vercel Blob
  ▼
PENDING_REVIEW (Jewelry.status = PENDING_REVIEW, GenerationJob.resultGlbUrl set)
  │  admin reviews
  ├──► PUBLISHED  (approved — Jewelry.glbUrl set, visible on /catalog)
  └──► REJECTED   (rejected — admin regenerates or uploads manual .glb)
```

If admin uploads a `.glb` manually:

```
DRAFT
  │  admin uploads .glb
  ▼
PUBLISHED  (skips PROCESSING/REVIEW; no GenerationJob created, Jewelry.glbUrl set directly)
```

If a generation fails:

```
PROCESSING
  │  provider returns FAILED
  ▼
GenerationJob.status = FAILED, Jewelry.status returns to DRAFT
Admin sees the error in the panel and can retry / change photos / upload manual.
```

When a fallback provider is configured (none in v1, but the chain supports it), the FAILED branch first tries `pickNextAutoProvider()` before terminating.

## Polling

In v1, polling is **manual** — the admin clicks "Обновить статус" between visits to the edit page. The action `pollJewelryJob` reads the job, calls the provider, re-hosts the GLB on Vercel Blob if successful, and updates the DB.

A `/api/cron/poll-jobs` Vercel Cron route is **deferred to Task 15** (deployment). Pseudocode for that future endpoint:

```ts
const inflight = await prisma.generationJob.findMany({
  where: { status: "PROCESSING", provider: { not: "manual" } },
});

for (const job of inflight) {
  const provider = getProvider(job.provider);
  const result = await provider.poll(job.providerJobId);

  if (result.status === "SUCCEEDED") {
    const blobUrl = await rehostGlb(result.resultGlbUrl, job.jewelryId);
    await prisma.$transaction([
      prisma.generationJob.update({
        where: { id: job.id },
        data: { status: "SUCCEEDED", resultGlbUrl: blobUrl, completedAt: new Date() },
      }),
      prisma.jewelry.update({
        where: { id: job.jewelryId },
        data: { status: "PENDING_REVIEW" },
      }),
    ]);
  } else if (result.status === "FAILED") {
    await prisma.generationJob.update({
      where: { id: job.id },
      data: { status: "FAILED", errorMessage: result.errorMessage, completedAt: new Date() },
    });
  }
}
```

The cron is intentionally idempotent: if it crashes mid-loop, the next run picks up where it left off.

## Dry-run mode

For development without burning Tripo3D or Replicate credits, set `DRY_RUN_3D_GEN=1` in `.env`:

- Both `Replicate.isAvailable()` and `Tripo3D.isAvailable()` return true even without their respective API keys.
- `start()` returns a dummy `providerJobId` (prefixed `dry-run-`) without calling any external API.
- `poll()` returns `SUCCEEDED` with a public Khronos sample GLB (the Avocado).
- The rest of the pipeline (re-host to Vercel Blob, admin review, approve → showroom) runs unchanged.
- The admin UI surfaces a yellow "Режим теста" banner so it's clear the result isn't real.

This gives a complete UI flow walkthrough at zero cost.

## Admin review UI

On `/admin/jewelry/[id]/edit` after a job succeeds:
- A green "Модель готова к проверке" badge appears in the **3D-модель** panel.
- Three actions:
  - **Утвердить** → copies `GenerationJob.resultGlbUrl` onto `Jewelry.glbUrl`, sets `status = PUBLISHED`. Showroom now renders this jewelry's real model on its anchors.
  - **Отклонить** → drops the Tripo blob, marks `GenerationJob.status = FAILED` with "Отклонено администратором", sets `Jewelry.status = REJECTED`.
  - **Открыть .glb для проверки** ↗ — opens the re-hosted GLB in a new tab so the admin can preview it in any glTF viewer before deciding.
- A "Загрузить .glb вручную" form is always available below — admin can replace any model at any time, regardless of generation state.

## Russian status labels

| DB value | UI label |
|---|---|
| `JewelryStatus.DRAFT` | `Черновик` |
| `JewelryStatus.PROCESSING` | `Генерация…` |
| `JewelryStatus.PENDING_REVIEW` | `Ожидает проверки` |
| `JewelryStatus.PUBLISHED` | `Опубликовано` |
| `JewelryStatus.REJECTED` | `Отклонено` |
| `GenerationJobStatus.QUEUED` | `В очереди` |
| `GenerationJobStatus.PROCESSING` | `Идёт генерация…` |
| `GenerationJobStatus.SUCCEEDED` | `Модель готова к проверке` |
| `GenerationJobStatus.FAILED` | `Не удалось сгенерировать` |

These labels are the source of truth for the UI; centralized in `lib/i18n/ru.ts` (`admin.jewelry.model.*` and `jewelryStatusLabels`).
