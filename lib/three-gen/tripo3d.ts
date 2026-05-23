import type { Provider, StartResult, PollResult, ProviderInput } from "./types";

// Tripo3D image-to-model adapter.
//
// Docs: https://docs.tripo3d.ai/get-started/quick-start.html
//   POST /v2/openapi/task    -> { data: { task_id } }
//   GET  /v2/openapi/task/:t -> { data: { status, output, ... } }
//
// `status` values seen in the wild: "queued" | "running" | "success" |
// "failed" | "cancelled" | "banned" | "expired" — anything that isn't
// "success" or a terminal-failure state is treated as still-processing.
//
// DRY-RUN MODE
// ────────────
// When DRY_RUN_3D_GEN=1 in the environment, the adapter short-circuits the
// real API entirely:
//   • isAvailable() returns true regardless of whether a real key is set.
//   • start() returns a fake providerJobId prefixed `dry-run-` (no charge).
//   • poll() returns SUCCEEDED with a public Khronos sample GLB.
// The rest of the pipeline (re-host to Vercel Blob, admin approval) runs
// unchanged — so the UI flow is fully exercisable without burning credits.

const BASE_URL = "https://api.tripo3d.ai";
const DEFAULT_MODEL_VERSION = "v3.0-20250812";

const NOT_CONFIGURED_ERROR =
  "Tripo3D не настроен. Добавьте TRIPO3D_API_KEY в .env, чтобы включить автоматическую генерацию 3D.";

// Public Khronos sample model (Avocado, ~400 KB, PBR + textures). Used in
// dry-run mode to exercise the rehost + admin-review path without calling
// any external 3D-generation service.
const DRY_RUN_SAMPLE_GLB =
  "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/Avocado/glTF-Binary/Avocado.glb";

const isDryRun = () => process.env.DRY_RUN_3D_GEN === "1";

function imageTypeFromUrl(url: string): "jpeg" | "png" | "webp" {
  const lower = url.toLowerCase().split("?")[0];
  if (lower.endsWith(".png")) return "png";
  if (lower.endsWith(".webp")) return "webp";
  return "jpeg";
}

/** Try common Tripo output keys in priority order. */
function pickGlbUrl(output: unknown): string | null {
  if (!output || typeof output !== "object") return null;
  const o = output as Record<string, unknown>;
  const candidateKeys = [
    "pbr_model",
    "model",
    "base_model",
    "model_url",
    "glb",
  ];
  for (const k of candidateKeys) {
    const v = o[k];
    if (typeof v === "string" && v.length > 0) return v;
  }
  // Fallback: any string in `output` that looks like a .glb URL.
  for (const v of Object.values(o)) {
    if (typeof v === "string" && v.toLowerCase().includes(".glb")) return v;
  }
  return null;
}

async function tripoFetch(path: string, init?: RequestInit): Promise<unknown> {
  const apiKey = process.env.TRIPO3D_API_KEY;
  if (!apiKey) throw new Error(NOT_CONFIGURED_ERROR);

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
  };
  if (init?.body) headers["Content-Type"] = "application/json";

  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { ...headers, ...(init?.headers as Record<string, string>) },
    cache: "no-store",
  });

  if (!res.ok) {
    let detail = "";
    try {
      detail = await res.text();
    } catch {
      /* ignore */
    }
    throw new Error(`Tripo3D ${path} → HTTP ${res.status}: ${detail.slice(0, 240)}`);
  }
  return res.json();
}

export const tripo3dProvider: Provider = {
  id: "tripo3d",

  // In dry-run, available even without a real key — useful for development.
  isAvailable: () => isDryRun() || Boolean(process.env.TRIPO3D_API_KEY),

  async start(input: ProviderInput): Promise<StartResult> {
    const photo = input.photoUrls[0];
    if (!photo) {
      return {
        ok: false,
        error: "Для генерации нужна хотя бы одна фотография украшения.",
      };
    }

    if (isDryRun()) {
      return {
        ok: true,
        providerJobId: `dry-run-${Date.now()}`,
        resultGlbUrl: null,
      };
    }

    if (!process.env.TRIPO3D_API_KEY) {
      return { ok: false, error: NOT_CONFIGURED_ERROR };
    }

    try {
      const data = (await tripoFetch("/v2/openapi/task", {
        method: "POST",
        body: JSON.stringify({
          type: "image_to_model",
          model_version: DEFAULT_MODEL_VERSION,
          file: {
            type: imageTypeFromUrl(photo),
            url: photo,
          },
          // texture defaults to true; PBR defaults to true. We let Tripo
          // pick model_seed / face_limit so the result is "reasonable".
        }),
      })) as { data?: { task_id?: string } };

      const taskId = data.data?.task_id;
      if (!taskId) {
        return {
          ok: false,
          error: "Tripo3D не вернул task_id",
        };
      }
      return {
        ok: true,
        providerJobId: taskId,
        resultGlbUrl: null,
      };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Tripo3D: неизвестная ошибка",
      };
    }
  },

  async poll(providerJobId: string): Promise<PollResult> {
    // Dry-run: return SUCCEEDED with the Khronos sample GLB so the rehost
    // and admin-review UI can be exercised end-to-end.
    if (isDryRun() || providerJobId.startsWith("dry-run-")) {
      return { status: "SUCCEEDED", resultGlbUrl: DRY_RUN_SAMPLE_GLB };
    }

    try {
      const data = (await tripoFetch(`/v2/openapi/task/${providerJobId}`)) as {
        data?: {
          status?: string;
          output?: unknown;
          error_message?: string;
          progress?: number;
        };
      };

      const status = data.data?.status ?? "";

      if (status === "success") {
        const url = pickGlbUrl(data.data?.output);
        if (!url) {
          return {
            status: "FAILED",
            errorMessage: "Tripo3D вернул success, но без URL модели",
          };
        }
        return { status: "SUCCEEDED", resultGlbUrl: url };
      }

      if (
        status === "failed" ||
        status === "cancelled" ||
        status === "banned" ||
        status === "expired"
      ) {
        return {
          status: "FAILED",
          errorMessage:
            data.data?.error_message ?? `Tripo3D статус: ${status}`,
        };
      }

      // queued | running | unknown -> still processing
      return { status: "PROCESSING" };
    } catch (err) {
      return {
        status: "FAILED",
        errorMessage:
          err instanceof Error ? err.message : "Tripo3D: poll error",
      };
    }
  },
};
