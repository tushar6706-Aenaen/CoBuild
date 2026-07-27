"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LOGIN_PATH } from "@/lib/auth/redirects";
import { projectDraftSchema, saveProject, validateForPublish } from "@cobuild/shared";

export type SaveResult = { ok: true; username: string; slug: string } | { ok: false; error: string };

/**
 * Persists a composer draft. The client uploads images straight to Storage
 * first and sends only the resulting paths, so this action stays small and
 * never handles file bytes (which would hit serverless body limits).
 */
export async function saveProjectAction(payload: unknown, isNew: boolean): Promise<SaveResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(LOGIN_PATH);

  const parsed = projectDraftSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "That draft isn't valid." };
  }
  const draft = parsed.data;

  if (draft.visibility !== "draft") {
    const problem = validateForPublish(draft);
    if (problem) return { ok: false, error: problem };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .maybeSingle<{ username: string | null }>();
  if (!profile?.username) return { ok: false, error: "Finish setting up your profile first." };

  // On edit, confirm ownership before touching anything. RLS would block the
  // write anyway, but failing here gives a real message instead of a silent
  // zero-row update.
  let existingSlug: string | undefined;
  if (!isNew) {
    const { data: existing } = await supabase
      .from("projects")
      .select("author_id, slug")
      .eq("id", draft.id)
      .maybeSingle<{ author_id: string; slug: string }>();
    if (!existing) return { ok: false, error: "That project no longer exists." };
    if (existing.author_id !== user.id) return { ok: false, error: "That isn't your project." };
    existingSlug = existing.slug;
  }

  try {
    const { slug } = await saveProject(supabase, user.id, draft, { isNew, existingSlug });
    return { ok: true, username: profile.username, slug };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Something went wrong saving.";
    console.error("[saveProjectAction]", error);
    return { ok: false, error: message };
  }
}
