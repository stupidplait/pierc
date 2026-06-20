import { NextResponse } from "next/server";
import { safeAssetFetch } from "@/lib/security/safe-fetch";

/**
 * Fetch a Vercel Blob URL from inside the function (no cross-origin challenge for
 * the browser) and stream it back as same-origin content. Shared by the
 * published-by-id, candidate-by-job and jewelry-by-id GLB proxy routes.
 *
 * `HEAD` is supported because viewers may probe Content-Length before loading —
 * that probe must also be same-origin or it trips the same firewall wall the GET
 * would.
 */

// Brief in-process cache of fetched blob bytes. Dev re-renders / HMR / the
// candidate-vs-current compare reload the SAME GLB many times within seconds;
// without this each load re-hits Vercel Blob from the dev machine's IP, and that
// bursty traffic can trip Vercel's "Security Checkpoint" (a 403 anti-abuse
// challenge the server-side fetch can't solve). A short TTL keeps memory bounded
// while absorbing those bursts; in prod it also lets concurrent showroom loads of
// a hot model share one upstream fetch.
const CACHE_TTL_MS = 10_000;
const MAX_ENTRIES = 32; // backstop so a burst of distinct models can't grow unbounded
const cache = new Map<string, { body: ArrayBuffer; length: string; at: number }>();

function glbHeaders(length: string | null): Record<string, string> {
  const h: Record<string, string> = {
    "Content-Type": "model/gltf-binary",
    "Cache-Control": "public, max-age=31536000, immutable",
  };
  if (length) h["Content-Length"] = length;
  return h;
}

function prune(now: number) {
  for (const [k, v] of cache) {
    if (now - v.at > CACHE_TTL_MS) cache.delete(k);
  }
  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value; // Map preserves insertion order → FIFO
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

export async function streamBlob(url: string, method: "GET" | "HEAD") {
  const isHead = method === "HEAD";
  const now = Date.now();

  const hit = cache.get(url);
  if (hit && now - hit.at < CACHE_TTL_MS) {
    return new NextResponse(isHead ? null : hit.body, {
      headers: glbHeaders(hit.length),
    });
  }

  let upstream: Response;
  try {
    upstream = await safeAssetFetch(url, { method, cache: "no-store" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Upstream fetch failed";
    return new NextResponse(isHead ? null : `Upstream error: ${msg}`, {
      status: 502,
    });
  }

  if (!upstream.ok) {
    // Vercel Blob's Security Checkpoint answers with a 403 HTML challenge page.
    // Detect it and return a clearer, retry-able 503 (not a generic 502) so the
    // cause is obvious in the network tab / error boundary — it clears on its own.
    const ct = upstream.headers.get("content-type") ?? "";
    if (upstream.status === 403 && ct.includes("text/html")) {
      return new NextResponse(
        isHead
          ? null
          : "Vercel Blob Security Checkpoint blocked this request (anti-abuse challenge on the blob host). It clears on its own — retry shortly.",
        { status: 503, headers: { "Retry-After": "30" } },
      );
    }
    return new NextResponse(isHead ? null : `Upstream HTTP ${upstream.status}`, {
      status: 502,
    });
  }

  if (isHead) {
    return new NextResponse(null, {
      headers: glbHeaders(upstream.headers.get("content-length")),
    });
  }

  // Buffer the body so we can both serve it now and cache it for the next load.
  const body = await upstream.arrayBuffer();
  const length = String(body.byteLength);
  cache.set(url, { body, length, at: now });
  prune(now);
  return new NextResponse(body, { headers: glbHeaders(length) });
}
