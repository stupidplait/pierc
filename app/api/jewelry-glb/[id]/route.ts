import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Proxy a published jewelry's `.glb` from Vercel Blob through this app's
// origin. Browsers fetching directly from `*.public.blob.vercel-storage.com`
// hit Vercel's "Security Checkpoint" challenge for cross-origin requests,
// which serves an HTML challenge page instead of the GLB and breaks
// `useGLTF()` / `GLTFLoader`. This route side-steps that by:
//
//   1. Resolving the jewelry id → blob URL on the server.
//   2. Fetching the blob from inside the Vercel function (no challenge).
//   3. Streaming the binary back to the browser as same-origin content.
//
// Cache headers are aggressive (1 year, immutable) because each GLB has a
// hash-suffixed blob key — a new GLB upload produces a new id-or-URL chain
// and the client invalidates naturally.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface Params {
  id: string;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<Params> },
) {
  const { id } = await params;

  const jewelry = await prisma.jewelry.findUnique({
    where: { id },
    select: { glbUrl: true, status: true },
  });

  if (!jewelry || !jewelry.glbUrl) {
    return new NextResponse("Not found", { status: 404 });
  }
  // Don't expose unpublished models — even if the id is known.
  if (jewelry.status !== "PUBLISHED" && jewelry.status !== "PENDING_REVIEW") {
    return new NextResponse("Not found", { status: 404 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(jewelry.glbUrl, { cache: "no-store" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Upstream fetch failed";
    return new NextResponse(`Upstream error: ${msg}`, { status: 502 });
  }

  if (!upstream.ok) {
    return new NextResponse(`Upstream HTTP ${upstream.status}`, {
      status: 502,
    });
  }

  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": "model/gltf-binary",
      "Content-Length": upstream.headers.get("content-length") ?? "",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
