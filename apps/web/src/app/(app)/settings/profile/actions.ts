"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LOGIN_PATH } from "@/lib/auth/redirects";
import { validateUsername, usernameIsTaken } from "@cobuild/shared";

export type SettingsState = { error?: string };

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

  const displayName = String(formData.get("displayName") ?? "").trim().slice(0, 80);
  const headline = String(formData.get("headline") ?? "").trim().slice(0, 120);
  const bio = String(formData.get("bio") ?? "").trim().slice(0, 280);
  const location = String(formData.get("location") ?? "").trim().slice(0, 120);
  const timezone = String(formData.get("timezone") ?? "").trim().slice(0, 60);
  const avatarPath = String(formData.get("avatarPath") ?? "").trim() || null;

  const roles = formData
    .getAll("roles")
    .map((r) => String(r))
    .filter((r) => ROLE_OPTIONS.has(r));

  const isStudent = formData.get("isStudent") === "on";
  const college = isStudent ? String(formData.get("college") ?? "").trim().slice(0, 120) : null;
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

  redirect(`/u/${check.username}`);
}
