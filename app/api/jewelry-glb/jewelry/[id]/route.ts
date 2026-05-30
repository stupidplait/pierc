import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertAdmin } from "@/lib/admin/auth-helpers";
import { streamBlob } from "@/app/api/jewelry-glb/_lib/stream-blob";

// Proxy a jewelry's current `.glb` for the ADMIN edit page, at ANY status.
//
// The sibling public [id] route deliberately serves only PUBLISHED/
// PENDING_REVIEW models. But the admin edit page legitimately previews its own
// model while a piece is still DRAFT (manual upload), PROCESSING (regenerating
// over a prior model), or REJECTED — so this admin-gated route skips the status
// guard. Same cross-origin-firewall reasoning as the other routes
// (see lib/jewelry/glb-proxy).

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface Params {
  id: string;
}

async function resolveUrl(id: string): Promise<string | null> {
  try {
    await assertAdmin();
  } catch {
    return null; // not an admin → treat as missing (don't leak existence)
  }
  const jewelry = await prisma.jewelry.findUnique({
    where: { id },
    select: { glbUrl: true },
  });
  return jewelry?.glbUrl ?? null;
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
