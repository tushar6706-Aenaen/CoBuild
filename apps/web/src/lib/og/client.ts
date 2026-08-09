import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@cobuild/db";

/**
 * A cookie-free, always-anonymous Supabase client for OG image routes.
 *
 * Link previews are rendered for crawlers, not for a signed-in viewer, so
 * reading `cookies()` here would be wrong twice over: it would make the route
 * viewer-dependent (defeating `revalidate`, since the output could differ per
 * request) and it would let an author's own session render a *draft* card that
 * a shared cache could then serve to everyone.
 *
 * Running as `anon` makes RLS do the access control: `public` and `unlisted`
 * projects resolve (an unlisted link is meant to work for whoever holds it —
 * and a preview exposes nothing the page itself wouldn't), drafts do not.
 */
export function createOgClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
