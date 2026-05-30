import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { streamBlob } from "@/app/api/jewelry-glb/_lib/stream-blob";

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
// Cache headers are aggressive (1 year, immutable) because callers append a
// `?v=<blob-key>` token (see lib/jewelry/glb-proxy) that changes whenever the
// model is re-uploaded — so a stale model is never pinned despite the stable id.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface Params {
  id: string;
}

async function resolveUrl(id: string): Promise<string | null> {
  const jewelry = await prisma.jewelry.findUnique({
    where: { id },
    select: { glbUrl: true, status: true },
  });
  if (!jewelry || !jewelry.glbUrl) return null;
  // Don't expose unpublished models — even if the id is known.
  if (jewelry.status !== "PUBLISHED" && jewelry.status !== "PENDING_REVIEW") {
    return null;
  }
  return jewelry.glbUrl;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<Params> },
) {
  const { id } = await params;
  const url = await resolveUrl(id);
  if (!url) return new NextResponse("Not found", { status: 404 });
  return streamBlob(url, "GET");
}

export async function HEAD(
  _request: Request,
  { params }: { params: Promise<Params> },
) {
  const { id } = await params;
  const url = await resolveUrl(id);
  if (!url) return new NextResponse(null, { status: 404 });
  return streamBlob(url, "HEAD");
}
