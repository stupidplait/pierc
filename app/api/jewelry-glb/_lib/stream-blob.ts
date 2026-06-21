import { NextResponse } from "next/server";
import {
  fetchBlobBytes,
  headBlob,
  peekBlobLength,
  BlobFetchError,
} from "@/lib/jewelry/blob-bytes";

/**
 * Fetch a Vercel Blob URL from inside the function (no cross-origin challenge for
 * the browser) and stream it back as same-origin content. Shared by the
 * published-by-id, candidate-by-job and jewelry-by-id GLB proxy routes.
 *
 * `HEAD` is supported because viewers may probe Content-Length before loading —
 * that probe must also be same-origin or it trips the same firewall wall the GET
 * would.
 *
 * The actual fetch (with its same-process cache, shared with the admin write
 * paths, and SSRF guard) lives in lib/jewelry/blob-bytes.ts. The render proxy
 * keeps its historical behavior of NOT retrying the checkpoint here — it returns a
 * retryable 503 and lets the client/error-boundary retry — so `retries` is 0.
 */

function glbHeaders(length: string | null): Record<string, string> {
  const h: Record<string, string> = {
    "Content-Type": "model/gltf-binary",
    "Cache-Control": "public, max-age=31536000, immutable",
  };
  if (length) h["Content-Length"] = length;
  return h;
}

export async function streamBlob(url: string, method: "GET" | "HEAD") {
  const isHead = method === "HEAD";

  if (isHead) {
    // Answer from cache when we still hold the bytes (the preview just streamed
    // them) — avoids a fresh HEAD that could itself trip the checkpoint.
    const cachedLength = peekBlobLength(url);
    if (cachedLength) {
      return new NextResponse(null, { headers: glbHeaders(cachedLength) });
    }
    let upstream: Response;
    try {
      upstream = await headBlob(url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upstream fetch failed";
      return new NextResponse(`Upstream error: ${msg}`, { status: 502 });
    }
    if (!upstream.ok) {
      const ct = upstream.headers.get("content-type") ?? "";
      if (upstream.status === 403 && ct.includes("text/html")) {
        return new NextResponse(null, {
          status: 503,
          headers: { "Retry-After": "30" },
        });
      }
      return new NextResponse(null, { status: 502 });
    }
    return new NextResponse(null, {
      headers: glbHeaders(upstream.headers.get("content-length")),
    });
  }

  try {
    const { body, length } = await fetchBlobBytes(url); // retries: 0 (proxy default)
    return new NextResponse(body, { headers: glbHeaders(length) });
  } catch (err) {
    if (err instanceof BlobFetchError && err.checkpoint) {
      // Vercel Blob's Security Checkpoint answers with a 403 HTML challenge page.
      // Surface a clearer, retry-able 503 (not a generic 502) so the cause is
      // obvious in the network tab / error boundary — it clears on its own.
      return new NextResponse(
        "Vercel Blob Security Checkpoint blocked this request (anti-abuse challenge on the blob host). It clears on its own — retry shortly.",
        { status: 503, headers: { "Retry-After": "30" } },
      );
    }
    if (err instanceof BlobFetchError && err.status != null) {
      return new NextResponse(`Upstream HTTP ${err.status}`, { status: 502 });
    }
    const msg = err instanceof Error ? err.message : "Upstream fetch failed";
    return new NextResponse(`Upstream error: ${msg}`, { status: 502 });
  }
}
