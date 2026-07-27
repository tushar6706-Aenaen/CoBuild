import type { NextRequest } from "next/server";

/** Where a signed-in, fully-onboarded user lands when no `next` was supplied. */
export const DEFAULT_SIGNED_IN_PATH = "/";

export const LOGIN_PATH = "/login";
export const ONBOARDING_PATH = "/onboarding";
export const AUTH_CALLBACK_PATH = "/auth/callback";

/**
 * Paths that must never be used as a post-login destination: bouncing back into
 * the auth flow either loops forever or re-runs a one-shot code exchange.
 */
const NON_DESTINATION_PREFIXES = [LOGIN_PATH, ONBOARDING_PATH, "/auth"];

/**
 * True if the string contains any C0 control character, space or DEL.
 * Written as a scan rather than a regex literal so no raw control byte ever
 * has to appear in this source file.
 */
function hasUnsafeChars(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code <= 0x20 || code === 0x7f) return true;
  }
  return false;
}

/**
 * Turn an untrusted `?next=` / `?redirectTo=` value into a safe same-origin path.
 *
 * Supabase validates the OAuth `redirectTo` against the dashboard allowlist, but
 * that allowlist is necessarily a wildcard over our own origin
 * (`http://localhost:3000/**`), so **any** query string on `/auth/callback` is
 * reachable by an attacker who crafts their own authorize URL. The `next` value
 * is therefore fully attacker-controlled and must be validated here.
 *
 * Rules — all must hold, otherwise `fallback` is returned:
 *  - non-empty, <= 512 chars, no control characters or whitespace
 *    (blocks CR/LF response-splitting and `%09javascript:` style tricks)
 *  - starts with a single `/`
 *  - is not protocol-relative (`//evil.com`) and contains no backslash
 *    (browsers normalise `\` to `/`, so `/\evil.com` is `//evil.com`)
 *  - re-parses against a throwaway origin without changing origin
 *  - does not point back into the auth flow
 */
export function sanitizeNextPath(
  raw: string | null | undefined,
  fallback: string = DEFAULT_SIGNED_IN_PATH,
): string {
  if (!raw || raw.length > 512) return fallback;
  if (hasUnsafeChars(raw)) return fallback;
  if (!raw.startsWith("/")) return fallback;
  if (raw.startsWith("//") || raw.includes("\\")) return fallback;

  let parsed: URL;
  try {
    parsed = new URL(raw, "https://cobuild.invalid");
  } catch {
    return fallback;
  }
  if (parsed.origin !== "https://cobuild.invalid") return fallback;

  const pathname = parsed.pathname;
  if (!pathname.startsWith("/")) return fallback;
  if (
    NON_DESTINATION_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    )
  ) {
    return fallback;
  }

  return `${pathname}${parsed.search}${parsed.hash}`;
}

/**
 * The origin to build absolute redirect URLs from.
 *
 * `NextResponse.redirect` requires an absolute URL, and deriving it from the
 * `Host` header alone makes the app vulnerable to host-header injection behind a
 * misconfigured proxy. Prefer an explicitly configured site URL when present.
 */
export function resolveSiteOrigin(request: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      // Misconfigured value — fall through to the request origin.
    }
  }
  return request.nextUrl.origin;
}

/** Error codes the callback route can hand to the login page via `?error=`. */
export type AuthErrorCode =
  | "provider_denied"
  | "missing_code"
  | "invalid_code"
  | "expired_link"
  | "wrong_device"
  | "server_error";

/**
 * Builds the `/login?error=…` URL. Only a fixed enum member is ever reflected —
 * never the provider's `error_description`, which is attacker-controlled text.
 */
export function loginErrorUrl(origin: string, code: AuthErrorCode, next?: string): URL {
  const url = new URL(LOGIN_PATH, origin);
  url.searchParams.set("error", code);
  if (next && next !== DEFAULT_SIGNED_IN_PATH) url.searchParams.set("next", next);
  return url;
}
