"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { markAllNotificationsRead, markNotificationRead } from "@cobuild/shared";
import { createClient } from "@/lib/supabase/server";
import { LOGIN_PATH } from "@/lib/auth/redirects";

/**
 * Both actions re-derive the user from the session rather than trusting an id
 * from the form. `notifications_update_own` would block a forged one anyway,
 * but a Server Action is a public HTTP endpoint — it should not depend on RLS
 * alone to decide whose rows it touches.
 *
 * `revalidatePath('/', 'layout')` rather than just the page: the unread badge
 * is rendered by the app-shell layout and appears on every route, so
 * revalidating only `/notifications` leaves a stale count everywhere else.
 */
export async function markAllRead(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(LOGIN_PATH);

  await markAllNotificationsRead(supabase, user.id);
  revalidatePath("/", "layout");
}

export async function markOneRead(id: string): Promise<void> {
  if (!id) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await markNotificationRead(supabase, id);
  revalidatePath("/", "layout");
}
