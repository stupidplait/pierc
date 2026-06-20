import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { asPhotos } from "@/lib/jewelry/format";
import {
  LOCAL_QUEUED_PREFIX,
  LOCAL_RUNNING_PREFIX,
} from "@/lib/three-gen/local";

// Pull-worker claim endpoint (see docs/22-local-fallback.md). The self-hosted
// worker POSTs here to atomically claim the oldest unclaimed local job, then
// generates the .glb and POSTs it back to /api/local-jobs/<id>/result.
//
// Auth: Bearer LOCAL_WORKER_SECRET, fail-closed (a missing secret rejects every
// request — unlike the cron route, there's no local-dev relaxation since this can
// move work forward).

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function authorize(req: Request): boolean {
  const expected = process.env.LOCAL_WORKER_SECRET;
  if (!expected) return false; // fail closed — never open
  return (req.headers.get("authorization") ?? "") === `Bearer ${expected}`;
}

export async function POST(req: Request) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Oldest unclaimed local job: provider=local, in flight, providerJobId still on
  // the queued prefix.
  const candidate = await prisma.generationJob.findFirst({
    where: {
      provider: "local",
      status: "PROCESSING",
      providerJobId: { startsWith: LOCAL_QUEUED_PREFIX },
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, providerJobId: true, jewelryId: true, inputPhotos: true },
  });
  if (!candidate || !candidate.providerJobId) {
    return NextResponse.json({ job: null });
  }

  // Atomic claim via compare-and-swap on the (unique) providerJobId: only the
  // worker whose update still matches the exact queued value wins; a concurrent
  // claimer sees count 0 and is told to retry.
  const claimToken = `${LOCAL_RUNNING_PREFIX}${randomUUID()}`;
  const res = await prisma.generationJob.updateMany({
    where: { id: candidate.id, providerJobId: candidate.providerJobId },
    data: { providerJobId: claimToken, startedAt: new Date() },
  });
  if (res.count === 0) {
    return NextResponse.json({ job: null, retry: true });
  }

  const photoUrls = asPhotos(candidate.inputPhotos).map((p) => p.url);
  return NextResponse.json({
    job: {
      id: candidate.id,
      jewelryId: candidate.jewelryId,
      providerJobId: claimToken,
      photoUrls,
    },
  });
}
