# 08 — Auto-3D Pipeline

## Goal

Make adding a new jewelry as low-effort as possible: admin uploads a few photos, the system produces a `.glb` automatically, and after a quick admin review the jewelry becomes immediately available for 3D fitting.

## Provider abstraction

A small interface in `lib/three-gen/types.ts` hides the specific provider:

```ts
export interface Provider {
  id: ProviderId;                                  // "tripo3d" | "manual"
  isAvailable(): boolean;
  start(input: ProviderInput): Promise<StartResult>;
  poll(providerJobId: string): Promise<PollResult>;
}
```

Implementations live alongside it:
- `tripo3d.ts` — primary auto-generation provider.
- `manual.ts` — no-op symmetry adapter; the manual upload UI bypasses the GenerationJob table entirely (writes `Jewelry.glbUrl` directly).

`pickAutoProvider()` returns the first configured auto provider; `pickNextAutoProvider(after)` returns the next available one in the priority chain (used for fallback, currently always returns null since Tripo3D is the only auto provider). Future providers (Replicate-hosted open-source, Stable Fast 3D, etc.) slot into `AUTO_PRIORITY` in `lib/three-gen/index.ts` without touching call sites.

## Provider comparison (research summary)

| Approach | Cost model | Quality on jewelry | Ops cost |
|---|---|---|---|
| **Tripo3D API** (primary) | Pay-per-task; small free trial credits on signup | Strong, PBR + textures via H3 model | ~zero — managed |
| Meshy AI API | Pay-per-task | Decent, fast | ~zero — managed; **removed in v1**: did not pass the cost/quality bar for adding a second managed vendor |
| Replicate-hosted open-source (TripoSR, Stable Fast 3D, InstantMesh) | Pay-per-second compute (~$0.01–0.05 per generation) | Lower than Tripo H3 | ~zero — managed; viable later as a cheaper fallback |
| Self-hosted TripoSR / Hunyuan3D | Software is free | Good | Requires a GPU server |
| Photogrammetry (Meshroom) | Free | Highest | Admin shoots 15–30 photos per item |

**v1 decision:** Tripo3D as the only configured auto provider, manual `.glb` upload as the always-free quality override. The provider abstraction is kept so swapping in / adding fallback providers later is a config change, not a rewrite.

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

For development without burning Tripo3D credits, set `DRY_RUN_3D_GEN=1` in `.env`:

- `Tripo3D.isAvailable()` returns true even without `TRIPO3D_API_KEY`.
- `start()` returns a dummy `providerJobId` (prefixed `dry-run-`) without calling the API.
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
