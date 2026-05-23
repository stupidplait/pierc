import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Health check — Task 1 demo target.
// Returns { ok: true, db: <bool> }; db=true only if Postgres responds to SELECT 1.
// Force dynamic so the DB ping runs at request time, not build time.
export const dynamic = "force-dynamic";

export async function GET() {
  let db = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = true;
  } catch {
    db = false;
  }
  return NextResponse.json({ ok: true, db });
}
