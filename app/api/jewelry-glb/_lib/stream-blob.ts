import { NextResponse } from "next/server";

/**
 * Fetch a Vercel Blob URL from inside the function (no cross-origin challenge)
 * and stream it back as same-origin content. Shared by the published-by-id and
 * candidate-by-job GLB proxy routes.
 *
 * `HEAD` is supported because the admin inspector probes Content-Length with a
 * HEAD before loading — that probe must also be same-origin or it trips the
 * same firewall 403/CORS wall the GET would.
 */
export async function streamBlob(url: string, method: "GET" | "HEAD") {
  const isHead = method === "HEAD";

  let upstream: Response;
  try {
    upstream = await fetch(url, { method, cache: "no-store" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Upstream fetch failed";
    return new NextResponse(isHead ? null : `Upstream error: ${msg}`, {
      status: 502,
    });
  }

  if (!upstream.ok) {
    return new NextResponse(isHead ? null : `Upstream HTTP ${upstream.status}`, {
      status: 502,
    });
  }

  const headers: Record<string, string> = {
    "Content-Type": "model/gltf-binary",
    "Cache-Control": "public, max-age=31536000, immutable",
  };
  const len = upstream.headers.get("content-length");
  if (len) headers["Content-Length"] = len;

  return new NextResponse(isHead ? null : upstream.body, { headers });
}
