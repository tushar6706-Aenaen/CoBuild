import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import type { Database } from "@cobuild/db";

/**
 * Server-side Supabase client for Server Components / Server Actions.
 * `cookies()` is async in Next 16 — this function must be awaited by callers.
 * Writes are best-effort: Server Components can't set cookies, so the
 * catch is expected there and relies on the proxy (middleware) to refresh
 * the session on the next request.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component — ignored, the proxy handles refresh.
          }
        },
      },
    },
  );
}

type PendingCookie = { name: string; value: string; options: CookieOptions };

/**
 * Supabase client for Route Handlers that need to write auth cookies onto a
 * response they construct themselves (the OAuth callback, sign-out, …).
 *
 * Rather than relying on Next merging `cookies().set()` mutations into a
 * `NextResponse.redirect(...)` that the handler builds by hand, every cookie
 * write is captured and replayed onto the response via `applyTo(response)`.
 * That also lets us forward the no-store headers `@supabase/ssr` supplies with
 * auth cookie writes, so a CDN can never cache one user's `Set-Cookie`.
 */
export async function createRouteHandlerClient() {
  const cookieStore = await cookies();
  const pendingCookies: PendingCookie[] = [];
  const pendingHeaders: Record<string, string> = {};

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value, options } of cookiesToSet) {
            pendingCookies.push({ name, value, options: options ?? {} });
          }
          for (const [key, headerValue] of Object.entries(headers ?? {})) {
            pendingHeaders[key] = headerValue;
          }
        },
      },
    },
  );

  /** Replay every captured cookie + cache header onto an outgoing response. */
  function applyTo<T extends NextResponse>(response: T): T {
    for (const { name, value, options } of pendingCookies) {
      response.cookies.set(name, value, options);
    }
    for (const [key, headerValue] of Object.entries(pendingHeaders)) {
      response.headers.set(key, headerValue);
    }
    return response;
  }

  return { supabase, applyTo };
}
