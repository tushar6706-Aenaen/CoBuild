"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LOGIN_PATH } from "@/lib/auth/redirects";
import {
  validateUsername,
  usernameIsTaken,
  DISPLAY_NAME_MAX,
  HEADLINE_MAX,
  BIO_MAX,
  LOCATION_MAX,
  TIMEZONE_MAX,
  COLLEGE_MAX,
} from "@cobuild/shared";

/**
 * `savedUsername` is set on success instead of redirecting from the server.
 *
 * A server-side `redirect` gave the form no success moment to attach anything
 * to, and routing the confirmation through a `?saved=1` param on the
 * destination didn't work either: the toast has to be queued by a component
 * that survives the navigation, and the profile page's own mount is the thing
 * being replaced. Handing the username back lets the form show the toast and
 * *then* navigate, so the message is queued in the shell layout that both
 * routes share and outlives the transition.
 */
export type SettingsState = { error?: string; savedUsername?: string };

const ROLE_OPTIONS = new Set(["developer", "designer", "founder", "other"]);
const LINK_KEYS = ["github", "website", "x", "linkedin", "behance", "dribbble", "figma"] as const;

export async function updateProfile(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(LOGIN_PATH);

  const rawUsername = String(formData.get("username") ?? "");
  const check = validateUsername(rawUsername);
  if (!check.ok) return { error: check.reason };

  // Only flag as taken if it resolves to someone else's row — unlike
  // onboarding, the candidate here is very often the user's own current name.
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", check.username)
    .maybeSingle();
  if (existing && existing.id !== user.id) {
    return { error: "That username is taken." };
  }

  const displayName = String(formData.get("displayName") ?? "").trim().slice(0, DISPLAY_NAME_MAX);
  const headline = String(formData.get("headline") ?? "").trim().slice(0, HEADLINE_MAX);
  const bio = String(formData.get("bio") ?? "").trim().slice(0, BIO_MAX);
  const location = String(formData.get("location") ?? "").trim().slice(0, LOCATION_MAX);
  const timezone = String(formData.get("timezone") ?? "").trim().slice(0, TIMEZONE_MAX);
  const avatarPath = String(formData.get("avatarPath") ?? "").trim() || null;

  const roles = formData
    .getAll("roles")
    .map((r) => String(r))
    .filter((r) => ROLE_OPTIONS.has(r));

  const isStudent = formData.get("isStudent") === "on";
  const college = isStudent ? String(formData.get("college") ?? "").trim().slice(0, COLLEGE_MAX) : null;
  const gradYearRaw = isStudent ? formData.get("gradYear") : null;
  const gradYear =
    isStudent && gradYearRaw ? Number.parseInt(String(gradYearRaw), 10) || null : null;

  const links: Record<string, string> = {};
  for (const key of LINK_KEYS) {
    const value = String(formData.get(`link_${key}`) ?? "").trim();
    if (value) links[key] = value;
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      username: check.username,
      display_name: displayName || null,
      headline: headline || null,
      bio: bio || null,
      avatar_url: avatarPath,
      roles: isStudent ? [...roles, "student"] : roles,
      is_student: isStudent,
      college,
      grad_year: gradYear,
      location: location || null,
      timezone: timezone || null,
      links,
    })
    .eq("id", user.id);

  if (error) {
    if (error.code === "23505") return { error: "That username is taken." };
    console.error("[settings/profile] update failed", error);
    return { error: "Something went wrong saving your profile. Try again." };
  }

  return { savedUsername: check.username };
}
