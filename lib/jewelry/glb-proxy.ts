/**
 * Same-origin proxy paths for jewelry GLBs.
 *
 * A browser can't load the raw `*.public.blob.vercel-storage.com` URL directly:
 * Vercel's edge firewall answers cross-origin requests — the `fetch`/`HEAD`
 * that `useGLTF` and the size probe issue — with a 403 "challenge" response
 * (`x-vercel-mitigated: challenge`) that carries no `Access-Control-Allow-Origin`
 * header, so the browser surfaces it as a CORS error. Routing every GLB load
 * through our own origin side-steps it: a server-side fetch is subject to
 * neither CORS nor the challenge. See app/api/jewelry-glb/*.
 *
 * Callers pass these paths into the viewers/links instead of the blob URL.
 * (Local `blob:`/`/...` URLs — e.g. the dropzone's object-URL preview — must
 * NOT be wrapped, which is why this lives at the call sites, not inside the
 * viewer components.)
 *
 * Three routes, three trust levels:
 *   • catalog   → public, only PUBLISHED/PENDING_REVIEW models  (app/api/jewelry-glb/[id])
 *   • admin     → signed-in admin, current model at any status  (…/jewelry/[id])
 *   • candidate → signed-in admin, an unapproved job result     (…/job/[jobId])
 */

/** Last path segment of a blob URL — changes whenever a new model is uploaded
 *  (keys are timestamp-based), so it doubles as a cache-busting version token
 *  that keeps the immutable-cached proxy response fresh after a re-upload. */
function versionToken(blobUrl: string | null | undefined): string | null {
  if (!blobUrl) return null;
  try {
    const last = new URL(blobUrl).pathname.split("/").pop();
    return last || null;
  } catch {
    return null;
  }
}

function withVersion(base: string, glbUrl: string | null | undefined): string {
  const v = versionToken(glbUrl);
  return v ? `${base}?v=${encodeURIComponent(v)}` : base;
}

/**
 * PUBLIC catalog model, by jewelry id — served by app/api/jewelry-glb/[id]
 * (only PUBLISHED/PENDING_REVIEW). Pass the current `glbUrl` so the proxy URL
 * changes when the model does (otherwise the immutable cache would pin a stale
 * model after re-approval).
 */
export function catalogGlbSrc(
  jewelryId: string,
  glbUrl?: string | null,
): string {
  return withVersion(`/api/jewelry-glb/${jewelryId}`, glbUrl);
}

/**
 * ADMIN current model, by jewelry id — served by app/api/jewelry-glb/jewelry/[id].
 * Admin-only and status-agnostic, so the edit page can preview a piece's model
 * even while it's DRAFT / PROCESSING / REJECTED (the public route refuses those).
 */
export function adminGlbSrc(jewelryId: string, glbUrl?: string | null): string {
  return withVersion(`/api/jewelry-glb/jewelry/${jewelryId}`, glbUrl);
}

/**
 * ADMIN unapproved generation candidate, by job id — served by
 * app/api/jewelry-glb/job/[jobId]. A job's result blob is immutable, so no
 * version token is needed.
 */
export function candidateGlbSrc(jobId: string): string {
  return `/api/jewelry-glb/job/${jobId}`;
}
