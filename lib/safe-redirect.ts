// Guard against open-redirect via attacker-controlled `callbackUrl`/`next`
// query params. A naive `startsWith("/")` check is NOT enough: browsers treat
// protocol-relative values like "//evil.com" and "/\\evil.com" as external
// hosts, so they must be rejected explicitly.
//
// Returns the path only if it is a same-origin, absolute internal path.
// Otherwise returns the provided fallback.
export function safeInternalPath(
  value: string | null | undefined,
  fallback: string,
): string {
  if (!value) return fallback;
  // Must be an absolute path…
  if (!value.startsWith("/")) return fallback;
  // …but NOT protocol-relative ("//host") or backslash-tricked ("/\\host").
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback;
  // Reject control chars / whitespace that browsers may normalize away.
  if (/[\x00-\x1f\x7f]/.test(value)) return fallback;
  return value;
}
