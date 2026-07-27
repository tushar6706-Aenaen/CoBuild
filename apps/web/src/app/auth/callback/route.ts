import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createRouteHandlerClient } from "@/lib/supabase/server";
import {
  ONBOARDING_PATH,
  loginErrorUrl,
  resolveSiteOrigin,
  sanitizeNextPath,
  type AuthErrorCode,
} from "@/lib/auth/redirects";

/**
 * OAuth / magic-link callback.
 *
 * Both GitHub and Google land here as a top-level GET navigation from
 * `https://<ref>.supabase.co/auth/v1/callback` with `?code=<auth code>`; the
 * default email templates land here the same way. Newer email templates that
 * use `{{ .TokenHash }}` arrive as `?token_hash=…&type=…` instead, so both
 * shapes are handled.
 *
 * PKCE: `@supabase/ssr@0.12.3` forces `flowType: "pkce"` on both the browser and
 * server clients (verified in `dist/main/createBrowserClient.js` /
 * `createServerClient.js`). `signInWithOAuth` on the browser writes the verifier
 * to the `sb-<ref>-auth-token-code-verifier` cookie, and `exchangeCodeForSession`
 * here reads it back out of that same cookie via the server client's cookie
 * storage adapter — no manual verifier plumbing is needed. auth-js deletes the
 * verifier on both the success and the failure path, and the auth code itself is
 * redeemed server-side by GoTrue, so a replayed `?code=` fails.
 */

// Reads cookies and exchanges a one-time code — never prerender or cache.
export const dynamic = "force-dynamic";

type ProfileRow = { username: string | null };

const EMAIL_OTP_TYPES: readonly EmailOtpType[] = [
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
];

function parseOtpType(value: string | null): EmailOtpType | null {
  if (!value) return null;
  return EMAIL_OTP_TYPES.includes(value as EmailOtpType) ? (value as EmailOtpType) : null;
}

/** Map an auth-js error onto one of our fixed, non-reflective error codes. */
function classifyAuthError(error: { name?: string; code?: string; message?: string }): AuthErrorCode {
  const name = error.name ?? "";
  const code = error.code ?? "";
  const message = (error.message ?? "").toLowerCase();

  if (name === "AuthPKCECodeVerifierMissingError" || message.includes("code verifier")) {
    // The verifier cookie lives in the browser that started the flow. Opening a
    // magic link in a different browser/device is the common cause.
    return "wrong_device";
  }
  if (code === "otp_expired" || message.includes("expired")) return "expired_link";
  return "invalid_code";
}

export async function GET(request: NextRequest) {
  const origin = resolveSiteOrigin(request);
  const params = request.nextUrl.searchParams;

  // Attacker-controlled: Supabase's redirect allowlist is a wildcard over our
  // own origin, so any query string on this route is reachable. Sanitised to a
  // same-origin path (or dropped) before it is ever used in a redirect.
  const next = sanitizeNextPath(params.get("next") ?? params.get("redirectTo"));

  const { supabase, applyTo } = await createRouteHandlerClient();

  const fail = (code: AuthErrorCode) =>
    applyTo(NextResponse.redirect(loginErrorUrl(origin, code, next)));

  // The provider (or GoTrue) rejected the request — e.g. the user hit "Cancel"
  // on the consent screen. `error_description` is never reflected back.
  if (params.get("error") || params.get("error_description")) {
    return fail("provider_denied");
  }

  const code = params.get("code");
  const tokenHash = params.get("token_hash");
  const otpType = parseOtpType(params.get("type"));

  let userId: string | null = null;

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error || !data.user) {
      return fail(error ? classifyAuthError(error) : "invalid_code");
    }
    userId = data.user.id;
  } else if (tokenHash && otpType) {
    const { data, error } = await supabase.auth.verifyOtp({
      type: otpType,
      token_hash: tokenHash,
    });
    if (error || !data.user) {
      return fail(error ? classifyAuthError(error) : "invalid_code");
    }
    userId = data.user.id;
  } else {
    return fail("missing_code");
  }

  // Onboarding gate. `profiles` is world-readable, but this runs with the
  // freshly-established session, so the row is the signed-in user's own.
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", userId)
    .maybeSingle<ProfileRow>();

  if (profileError) {
    // Fail closed: send them through onboarding rather than into the app with
    // an unknown username state.
    console.error("[auth/callback] profile lookup failed", profileError);
  }

  // No row yet (signup trigger race) or username not claimed -> onboarding,
  // carrying the sanitised destination so onboarding can finish the journey.
  const needsOnboarding = !profile || profile.username === null || profileError !== null;

  const destination = needsOnboarding
    ? (() => {
        const url = new URL(ONBOARDING_PATH, origin);
        if (next !== "/") url.searchParams.set("next", next);
        return url;
      })()
    : new URL(next, origin);

  return applyTo(NextResponse.redirect(destination));
}
