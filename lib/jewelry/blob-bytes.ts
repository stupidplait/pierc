// Resilient server-side fetch of a Vercel Blob GLB, shared by the render proxy
// (app/api/jewelry-glb/_lib/stream-blob.ts) and the admin write paths that have to
// re-download the current model to mutate it (orientation nudge, attach-point
// picker, hybrid rebuild, scale analysis — lib/admin/jewelry-actions.ts).
//
// Why this exists: the blob host (`*.public.blob.vercel-storage.com`) sits behind
// Vercel's anti-abuse "Security Checkpoint", which answers a burst of requests —
// INCLUDING server-side ones — with a 403 HTML challenge page that the fetch can't
// solve (`x-vercel-mitigated: challenge`). The render proxy already tolerated this
// (short cache + a retryable 503); the write paths did NOT — they did a naked
// `fetch(glbUrl)` whose comment wrongly claimed server fetches aren't challenged,
// so the "Save" in the point-picker / rotate tools failed with "HTTP 403" exactly
// when the checkpoint was active (reliably so from a dev machine's IP). This helper
// fixes that by (a) reusing the bytes the preview just streamed (same-process cache)
// and (b) retrying the checkpoint with backoff instead of failing on the first 403.

import { safeAssetFetch } from "@/lib/security/safe-fetch";

const CACHE_TTL_MS = 10_000;
const MAX_ENTRIES = 32; // backstop so a burst of distinct models can't grow unbounded

interface CacheEntry {
  body: ArrayBuffer;
  length: string;
  at: number;
}

// Module-level cache. The render proxy fills it when the admin previews a model;
// the write paths read from it moments later when the admin clicks "Save", so the
// common case needs ZERO extra blob hits (and thus can't trip the checkpoint).
const cache = new Map<string, CacheEntry>();

function prune(now: number): void {
  for (const [k, v] of cache) {
    if (now - v.at > CACHE_TTL_MS) cache.delete(k);
  }
  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value; // Map preserves insertion order → FIFO
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Thrown when a blob fetch ultimately fails. `checkpoint` marks the Vercel Blob
 *  Security Checkpoint case (a transient anti-abuse 403 HTML challenge) so callers
 *  can show a "retry shortly" message instead of a generic error. */
export class BlobFetchError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly checkpoint: boolean,
  ) {
    super(message);
    this.name = "BlobFetchError";
  }
}

/** True when an upstream response is the blob host's anti-abuse challenge page. */
function isCheckpoint(res: Response): boolean {
  const ct = res.headers.get("content-type") ?? "";
  return res.status === 403 && ct.includes("text/html");
}

export interface BlobBytes {
  body: ArrayBuffer;
  length: string;
}

export interface FetchBlobOptions {
  /** Extra attempts after the first when the host returns its checkpoint 403 (or a
   *  network error). 0 preserves the old immediate-fail behavior (render proxy). */
  retries?: number;
  /** Base backoff between retries (ms); grows linearly with the attempt number. */
  retryDelayMs?: number;
}

/**
 * Fetch a blob's bytes with a same-process cache and checkpoint-aware retry.
 *
 * - Serves from cache when fetched within the TTL (the preview just did).
 * - On the checkpoint 403 (or a transient network error) retries up to `retries`
 *   times with linear backoff — the challenge "clears on its own".
 * - On any other non-OK status, fails immediately (retrying a 404/410 is pointless).
 *
 * Throws `BlobFetchError` on terminal failure. Never mutates the returned buffer —
 * callers (gltf-transform read) treat it read-only, so sharing the cached instance
 * is safe.
 */
export async function fetchBlobBytes(
  url: string,
  opts: FetchBlobOptions = {},
): Promise<BlobBytes> {
  const retries = opts.retries ?? 0;
  const retryDelayMs = opts.retryDelayMs ?? 600;

  const now = Date.now();
  const hit = cache.get(url);
  if (hit && now - hit.at < CACHE_TTL_MS) {
    return { body: hit.body, length: hit.length };
  }

  let lastStatus: number | null = null;
  let lastCheckpoint = false;
  let lastDetail = "fetch failed";

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await delay(retryDelayMs * attempt);

    let res: Response;
    try {
      res = await safeAssetFetch(url, { cache: "no-store" });
    } catch (err) {
      // Network/DNS error — transient, worth a retry.
      lastStatus = null;
      lastCheckpoint = false;
      lastDetail = err instanceof Error ? err.message : "network error";
      continue;
    }

    if (res.ok) {
      const body = await res.arrayBuffer();
      const length = String(body.byteLength);
      cache.set(url, { body, length, at: Date.now() });
      prune(Date.now());
      return { body, length };
    }

    lastStatus = res.status;
    lastCheckpoint = isCheckpoint(res);
    lastDetail = lastCheckpoint
      ? "Vercel Blob Security Checkpoint (anti-abuse 403)"
      : `HTTP ${res.status}`;
    // Only the checkpoint is transient; a real error (404/410/…) won't self-heal.
    if (!lastCheckpoint) break;
  }

  throw new BlobFetchError(lastDetail, lastStatus, lastCheckpoint);
}

/** Content-Length of a still-fresh cached entry, or null. Lets the HEAD proxy
 *  answer a probe for an already-streamed model without a fresh network hit (which
 *  could otherwise trip the checkpoint even though we hold the bytes). */
export function peekBlobLength(url: string): string | null {
  const hit = cache.get(url);
  return hit && Date.now() - hit.at < CACHE_TTL_MS ? hit.length : null;
}

/** Lightweight HEAD probe (Content-Length only) with the same SSRF guard. Used by
 *  the proxy's HEAD route; no body, no cache. */
export async function headBlob(url: string): Promise<Response> {
  return safeAssetFetch(url, { method: "HEAD", cache: "no-store" });
}
