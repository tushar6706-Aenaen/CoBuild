import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@cobuild/db";
import {
  DEFAULT_SIGNED_IN_PATH,
  LOGIN_PATH,
  ONBOARDING_PATH,
  sanitizeNextPath,
} from "@/lib/auth/redirects";

/**
 * Next 16 renamed `middleware.ts` to `proxy.ts` (export `proxy`, not
 * `middleware`). This refreshes the Supabase auth session on every matched
 * request so Server Components always see a valid session, and enforces the
 * "signed in but `username IS NULL` means onboarding" rule at the edge.
 *
 * Cookie handling: every write from `@supabase/ssr` is captured into
 * `pendingCookies` and replayed onto whichever response we end up returning —
 * `next()` *or* a redirect. Building the response inside `setAll` (the shape in
 * the Supabase quickstart) silently drops refreshed tokens whenever the proxy
 * returns a redirect instead, which logs the user out on the following request.
 *
 * `/auth/*` is excluded from the matcher entirely: the callback route runs its
 * own code exchange and writes its own session cookies, and having the proxy
 * concurrently attempt a refresh on the same request is the one place where two
 * writers could emit conflicting `Set-Cookie` headers for the same token.
 */

type PendingCookie = { name: string; value: string; options: CookieOptions };

/** Signed-in users are bounced out of these. */
const AUTH_ENTRY_PATHS = [LOGIN_PATH];

/** Require a signed-in, onboarded user. Extend as authenticated routes land. */
const PROTECTED_PREFIXES = ["/new", "/settings", "/notifications", "/bookmarks"];

function isUnder(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function proxy(request: NextRequest) {
  const pendingCookies: PendingCookie[] = [];
  const pendingHeaders: Record<string, string> = {};

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value, options } of cookiesToSet) {
            // Keep the forwarded request in sync so downstream Server
            // Components read the refreshed token, not the stale one.
            request.cookies.set(name, value);
            pendingCookies.push({ name, value, options: options ?? {} });
          }
          for (const [key, headerValue] of Object.entries(headers ?? {})) {
            pendingHeaders[key] = headerValue;
          }
        },
      },
    },
  );

  // Must run before any response is produced, otherwise a refresh that lands
  // late cannot be written to the response and the next request refreshes again.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;

  let response: NextResponse | null = null;

  if (!user) {
    if (isUnder(pathname, PROTECTED_PREFIXES) || pathname === ONBOARDING_PATH) {
      const url = request.nextUrl.clone();
      url.pathname = LOGIN_PATH;
      url.search = "";
      const intended = sanitizeNextPath(`${pathname}${search}`);
      if (intended !== DEFAULT_SIGNED_IN_PATH) url.searchParams.set("next", intended);
      response = NextResponse.redirect(url);
    }
  } else if (isUnder(pathname, PROTECTED_PREFIXES) || isUnder(pathname, AUTH_ENTRY_PATHS) || pathname === ONBOARDING_PATH) {
    // Only pay for the profile lookup on routes whose behaviour depends on it.
    const { data: profile } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .maybeSingle<{ username: string | null }>();

    const needsOnboarding = (profile?.username ?? null) === null;

    if (needsOnboarding && pathname !== ONBOARDING_PATH) {
      const url = request.nextUrl.clone();
      url.pathname = ONBOARDING_PATH;
      url.search = "";
      const intended = sanitizeNextPath(`${pathname}${search}`);
      if (intended !== DEFAULT_SIGNED_IN_PATH) url.searchParams.set("next", intended);
      response = NextResponse.redirect(url);
    } else if (!needsOnboarding && (isUnder(pathname, AUTH_ENTRY_PATHS) || pathname === ONBOARDING_PATH)) {
      // `next` here came in on our own URL and is still untrusted.
      const target = sanitizeNextPath(request.nextUrl.searchParams.get("next"));
      response = NextResponse.redirect(new URL(target, request.nextUrl.origin));
    }
  }

  const finalResponse = response ?? NextResponse.next({ request });

  for (const { name, value, options } of pendingCookies) {
    finalResponse.cookies.set(name, value, options);
  }
  for (const [key, headerValue] of Object.entries(pendingHeaders)) {
    finalResponse.headers.set(key, headerValue);
  }

  return finalResponse;
}

export const config = {
  matcher: [
    // Everything except static assets and `/auth/*` (the callback owns its own
    // session cookie writes — see the note above).
    "/((?!auth/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)",
  ],
};
