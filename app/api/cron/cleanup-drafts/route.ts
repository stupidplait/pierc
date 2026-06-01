import { NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { asPhotos } from "@/lib/jewelry/format";

// Vercel Cron — reaps abandoned, never-named jewelry drafts.
//
// Lazy creation (the /admin/jewelry/new editor persists nothing until the first
// save) means the UI no longer mints blank rows. But two sources still leave
// them: legacy rows from the old "create a DRAFT on click" flow, and the rare
// case where someone uploaded media against a draft and walked away without
// naming it. An empty `name` is the sentinel for "never saved" (the editor
// requires a name), and the catalog already hides these — this sweep deletes
// them outright (with their blobs) so they don't accumulate forever.
//
// A grace window protects a draft someone may still be editing. Auth mirrors
// the other crons: require `Authorization: Bearer ${CRON_SECRET}` when the
// secret is set; open in dev so it can be hit with curl.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60; // best-effort blob deletes can be slow

// Don't touch a blank draft younger than this — it may be open in an editor.
const ABANDON_AFTER_MS = 24 * 60 * 60 * 1000; // 24h

export async function GET(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - ABANDON_AFTER_MS);

  const stale = await prisma.jewelry.findMany({
    where: { status: "DRAFT", name: "", updatedAt: { lt: cutoff } },
    select: { id: true, photos: true, glbUrl: true, spriteUrl: true },
    take: 200, // safety cap — a daily sweep never needs to clear more at once
  });

  // Best-effort blob cleanup before the rows go. Orphan blobs are acceptable
  // (a dangling row is not), so a failed delete never blocks the reap.
  let blobsDeleted = 0;
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    for (const j of stale) {
      const urls = [
        ...asPhotos(j.photos).map((p) => p.url),
        j.glbUrl,
        j.spriteUrl,
      ].filter((u): u is string => !!u);
      const settled = await Promise.allSettled(urls.map((u) => del(u)));
      blobsDeleted += settled.filter((s) => s.status === "fulfilled").length;
    }
  }

  const ids = stale.map((j) => j.id);
  if (ids.length) {
    // anchorBindings + jobs cascade on delete (see prisma/schema.prisma).
    await prisma.jewelry.deleteMany({ where: { id: { in: ids } } });
  }

  return NextResponse.json({ ok: true, reaped: ids.length, blobsDeleted });
}

function authorize(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return true; // dev / unconfigured mode
  const auth = request.headers.get("authorization") ?? "";
  return auth === `Bearer ${expected}`;
}
