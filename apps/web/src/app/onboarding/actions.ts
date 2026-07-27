"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LOGIN_PATH, sanitizeNextPath } from "@/lib/auth/redirects";
import { validateUsername, usernameIsTaken } from "@cobuild/shared";

export type OnboardingState = { error?: string };

const ROLE_OPTIONS = new Set(["developer", "designer", "founder", "other"]);

export async function completeOnboarding(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(LOGIN_PATH);

  const rawUsername = String(formData.get("username") ?? "");
  const check = validateUsername(rawUsername);
  if (!check.ok) return { error: check.reason };

  // Defensive re-check: the client already does this live, but a race
  // between two tabs claiming the same handle is only caught server-side.
  // The DB's citext unique index is the real backstop either way.
  if (await usernameIsTaken(supabase, check.username)) {
    return { error: "That username was just taken — try another." };
  }

  const displayName = String(formData.get("displayName") ?? "").trim().slice(0, 80);
  const bio = String(formData.get("bio") ?? "").trim().slice(0, 280);
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

  const finalRoles = isStudent ? [...roles, "student"] : roles;

  const { error } = await supabase
    .from("profiles")
    .update({
      username: check.username,
      display_name: displayName || null,
      bio: bio || null,
      avatar_url: avatarPath,
      roles: finalRoles,
      is_student: isStudent,
      college,
      grad_year: gradYear,
    })
    .eq("id", user.id);

  if (error) {
    // Format/reserved-word checks already ran client- and server-side above,
    // so a constraint violation here almost always means the citext unique
    // index caught a race the pre-check above missed.
    if (error.code === "23505") {
      return { error: "That username was just taken — try another." };
    }
    console.error("[onboarding] profile update failed", error);
    return { error: "Something went wrong saving your profile. Try again." };
  }

  const next = sanitizeNextPath(String(formData.get("next") ?? ""));
  redirect(next);
}
