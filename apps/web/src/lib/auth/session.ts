import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { LOGIN_PATH, ONBOARDING_PATH } from "./redirects";

export type AuthState = {
  user: User | null;
  /** `null` when signed out, or when the profile row hasn't materialised yet. */
  username: string | null;
  /** Signed in but hasn't claimed a username. */
  needsOnboarding: boolean;
};

/**
 * Reads the authenticated user and their onboarding state in a Server Component.
 *
 * Always uses `getUser()` (which validates the JWT against the auth server), not
 * `getSession()` — cookie contents are attacker-supplied until verified.
 *
 * The proxy also gates protected routes, but Next's own docs warn that proxy
 * coverage can silently disappear when matchers or routes are refactored, so
 * every authenticated page/Server Action should call this too.
 */
export async function getAuthState(): Promise<AuthState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { user: null, username: null, needsOnboarding: false };

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .maybeSingle<{ username: string | null }>();

  const username = profile?.username ?? null;
  return { user, username, needsOnboarding: username === null };
}

/**
 * Guard for pages that require a signed-in, fully-onboarded user.
 * Redirects to `/login` or `/onboarding` (preserving `next`) otherwise.
 */
export async function requireOnboardedUser(currentPath?: string): Promise<{
  user: User;
  username: string;
}> {
  const state = await getAuthState();
  const nextParam = currentPath ? `?next=${encodeURIComponent(currentPath)}` : "";

  if (!state.user) redirect(`${LOGIN_PATH}${nextParam}`);
  if (state.username === null) redirect(`${ONBOARDING_PATH}${nextParam}`);

  return { user: state.user, username: state.username };
}
