import { NextResponse, type NextRequest } from "next/server";
import { createRouteHandlerClient } from "@/lib/supabase/server";
import { LOGIN_PATH, resolveSiteOrigin } from "@/lib/auth/redirects";

/**
 * POST-only by design: an `<img src>` or any other GET-triggerable request
 * from a third-party page must not be able to sign a user out.
 */
export async function POST(request: NextRequest) {
  const { supabase, applyTo } = await createRouteHandlerClient();
  await supabase.auth.signOut();

  const origin = resolveSiteOrigin(request);
  return applyTo(NextResponse.redirect(new URL(LOGIN_PATH, origin)));
}
