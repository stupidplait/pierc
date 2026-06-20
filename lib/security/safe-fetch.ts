// SSRF guard for server-side fetches of remote, partially-untrusted asset URLs
// (3D-provider GLB rehost, blob proxy). These URLs originate from provider poll
// responses and admin-gated DB columns — not anonymous user input — so this is
// defense-in-depth: it guarantees a server-side fetch can never be pointed at an
// internal / loopback / link-local address (cloud metadata at 169.254.169.254,
// localhost services, the private VPC) or a non-HTTPS scheme, regardless of how a
// URL got into the pipeline.
//
// Note: this validates the *initial* URL. A redirect to a private host is not
// re-checked here; provider CDNs we rehost from serve assets directly, so the
// initial-URL check is the meaningful boundary for the current threat model.

function isPrivateIPv4(host: string): boolean {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const octets = m.slice(1, 5).map(Number);
  // Malformed octet → treat as unsafe rather than risk a parser quirk.
  if (octets.some((n) => n > 255)) return true;
  const [a, b] = octets as [number, number, number, number];
  if (a === 0) return true; // "this" network
  if (a === 10) return true; // private
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local incl. cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT (RFC 6598)
  return false;
}

function isPrivateHost(rawHost: string): boolean {
  const host = rawHost.toLowerCase();
  if (!host) return true;
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (host.endsWith(".local") || host.endsWith(".internal")) return true;
  // IPv6 literals arrive from URL.hostname wrapped in brackets, e.g. "[::1]".
  if (host.startsWith("[")) {
    const h = host.replace(/^\[|\]$/g, "");
    if (h === "::1" || h === "::") return true;
    if (h.startsWith("fc") || h.startsWith("fd")) return true; // ULA fc00::/7
    if (h.startsWith("fe80")) return true; // link-local
    const mapped = h.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
    if (mapped) return isPrivateIPv4(mapped[1] as string);
    return false;
  }
  return isPrivateIPv4(host);
}

export function isSafeAssetUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "https:") return false;
  if (u.username || u.password) return false; // no embedded credentials
  if (!u.hostname) return false;
  if (isPrivateHost(u.hostname)) return false;
  return true;
}

export function assertSafeAssetUrl(raw: string): string {
  if (!isSafeAssetUrl(raw)) {
    let host = "(unparseable)";
    try {
      host = new URL(raw).hostname || host;
    } catch {
      /* keep placeholder */
    }
    throw new Error(`Refusing server-side fetch of unsafe URL host: ${host}`);
  }
  return raw;
}

/** Drop-in `fetch` that fails closed on internal/non-HTTPS targets. */
export async function safeAssetFetch(
  raw: string,
  init?: RequestInit,
): Promise<Response> {
  assertSafeAssetUrl(raw);
  return fetch(raw, init);
}
