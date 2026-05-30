import type {
  Provider,
  StartResult,
  PollResult,
  ProviderInput,
} from "./types";

// Replicate-hosted image-to-3D adapter.
//
// Docs: https://replicate.com/docs/reference/http
//   POST /v1/predictions          → { id, status, … }    (status = starting)
//   GET  /v1/predictions/{id}     → { id, status, output, error, … }
//
// Auth uses the literal word "Token" (not "Bearer"):
//   Authorization: Token <REPLICATE_API_TOKEN>
//
// Status values: "starting" | "processing" | "succeeded" | "failed" | "canceled"
// Anything that isn't a terminal state (succeeded/failed/canceled) is
// treated as still-processing. Replicate's `output` field has a model-
// specific shape — see `pickGlbUrl` below for the three shapes we
// tolerate (string, array, object with common GLB keys).
//
// DRY-RUN MODE
// ────────────
// Same `DRY_RUN_3D_GEN=1` switch as the Tripo3D adapter — short-circuits
// the API entirely and returns the Khronos `Avocado.glb` sample so the
// rehost + admin-review path can be exercised without spending compute.

const BASE_URL = "https://api.replicate.com/v1";

const NOT_CONFIGURED_ERROR =
  "Replicate не настроен. Добавьте REPLICATE_API_TOKEN и REPLICATE_MODEL в .env, чтобы включить автогенерацию 3D через Replicate.";

const DRY_RUN_SAMPLE_GLB =
  "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/Avocado/glTF-Binary/Avocado.glb";

const isDryRun = () => process.env.DRY_RUN_3D_GEN === "1";

/**
 * Resolve the env-supplied `REPLICATE_MODEL` into the version hash that
 * Replicate's predictions API actually wants in the request body. We
 * accept three formats so admins can copy-paste the value Replicate
 * shows on the model page:
 *   • `<hash>`                       — bare 64-hex version hash
 *   • `owner/name:<hash>`            — slug + version (recommended; pin)
 *   • `owner/name`                   — slug only → null (caller falls back
 *                                      to the model-level endpoint, which
 *                                      uses the latest version)
 *
 * Returns `{ version, slug }` so callers can pick the right endpoint.
 */
function parseModel(spec: string | undefined):
  | { kind: "version"; version: string }
  | { kind: "slug"; slug: string }
  | null {
  if (!spec) return null;
  const trimmed = spec.trim();
  if (!trimmed) return null;
  if (trimmed.includes(":")) {
    const [, version] = trimmed.split(":", 2);
    if (version) return { kind: "version", version };
  }
  if (/^[0-9a-f]{40,}$/i.test(trimmed)) {
    return { kind: "version", version: trimmed };
  }
  if (trimmed.includes("/")) {
    return { kind: "slug", slug: trimmed };
  }
  return null;
}

/**
 * Replicate model outputs vary in shape — try common patterns in order.
 * The runtime contract is "give me a `.glb` URL" so we filter to URLs
 * containing ".glb" (case-insensitive).
 */
function pickGlbUrl(output: unknown): string | null {
  if (typeof output === "string") {
    return output.toLowerCase().includes(".glb") ? output : output;
  }
  if (Array.isArray(output)) {
    for (const v of output) {
      if (typeof v === "string" && v.toLowerCase().includes(".glb")) return v;
    }
    // No .glb-shaped URL — return first string anyway so admins see what
    // came back rather than a silent failure.
    for (const v of output) {
      if (typeof v === "string" && v.length > 0) return v;
    }
    return null;
  }
  if (output && typeof output === "object") {
    const o = output as Record<string, unknown>;
    const candidateKeys = [
      "mesh_glb",
      "mesh",
      "glb",
      "model",
      "model_url",
      "model_glb",
      "output",
      "url",
    ];
    for (const k of candidateKeys) {
      const v = o[k];
      if (typeof v === "string" && v.length > 0) return v;
    }
    // Last resort: any string field whose value looks like a .glb URL.
    for (const v of Object.values(o)) {
      if (typeof v === "string" && v.toLowerCase().includes(".glb")) return v;
    }
  }
  return null;
}

async function replicateFetch(
  path: string,
  init?: RequestInit,
): Promise<unknown> {
  const apiKey = process.env.REPLICATE_API_TOKEN;
  if (!apiKey) throw new Error(NOT_CONFIGURED_ERROR);

  const headers: Record<string, string> = {
    Authorization: `Token ${apiKey}`,
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
    throw new Error(
      `Replicate ${path} → HTTP ${res.status}: ${detail.slice(0, 240)}`,
    );
  }
  return res.json();
}

export const replicateProvider: Provider = {
  id: "replicate",

  isAvailable: () =>
    isDryRun() ||
    Boolean(process.env.REPLICATE_API_TOKEN && process.env.REPLICATE_MODEL),

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

    if (!process.env.REPLICATE_API_TOKEN) {
      return { ok: false, error: NOT_CONFIGURED_ERROR };
    }

    const model = parseModel(process.env.REPLICATE_MODEL);
    if (!model) {
      return {
        ok: false,
        error:
          "REPLICATE_MODEL не задан или имеет неверный формат. Ожидается '<owner>/<name>:<hash>' или просто '<hash>'.",
      };
    }

    // Path + body shape differ depending on whether we have a version
    // hash to pin (predictions endpoint) or only a slug (model-specific
    // endpoint, uses the model's latest published version).
    const path =
      model.kind === "version"
        ? "/predictions"
        : `/models/${model.slug}/predictions`;

    const body: Record<string, unknown> = {
      input: {
        image: photo,
      },
    };
    if (model.kind === "version") body.version = model.version;

    try {
      const data = (await replicateFetch(path, {
        method: "POST",
        body: JSON.stringify(body),
      })) as { id?: string; status?: string; error?: string | null };

      if (!data.id) {
        return {
          ok: false,
          error:
            data.error ?? "Replicate не вернул prediction id",
        };
      }
      return {
        ok: true,
        providerJobId: data.id,
        resultGlbUrl: null,
      };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Replicate: неизвестная ошибка",
      };
    }
  },

  async poll(providerJobId: string): Promise<PollResult> {
    if (isDryRun() || providerJobId.startsWith("dry-run-")) {
      return { status: "SUCCEEDED", resultGlbUrl: DRY_RUN_SAMPLE_GLB };
    }

    try {
      const data = (await replicateFetch(`/predictions/${providerJobId}`)) as {
        status?: string;
        output?: unknown;
        error?: unknown;
      };

      const status = data.status ?? "";

      if (status === "succeeded") {
        const url = pickGlbUrl(data.output);
        if (!url) {
          return {
            status: "FAILED",
            errorMessage:
              "Replicate вернул succeeded, но без URL модели в output",
          };
        }
        return { status: "SUCCEEDED", resultGlbUrl: url };
      }

      if (status === "failed" || status === "canceled") {
        const errMsg =
          typeof data.error === "string"
            ? data.error
            : `Replicate статус: ${status}`;
        return { status: "FAILED", errorMessage: errMsg };
      }

      // starting | processing | unknown → still in flight
      return { status: "PROCESSING" };
    } catch (err) {
      return {
        status: "FAILED",
        errorMessage:
          err instanceof Error ? err.message : "Replicate: poll error",
      };
    }
  },
};
