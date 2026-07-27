import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { requireOnboardedUser } from "@/lib/auth/session";
import { SignOutButton } from "@/components/sign-out-button";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = {
  title: "Edit profile — CoBuild",
};

type ProfileRow = {
  username: string | null;
  display_name: string | null;
  headline: string | null;
  bio: string | null;
  avatar_url: string | null;
  roles: string[];
  is_student: boolean;
  college: string | null;
  grad_year: number | null;
  location: string | null;
  timezone: string | null;
  links: Record<string, string> | null;
};

export default async function SettingsProfilePage() {
  const { user, username } = await requireOnboardedUser("/settings/profile");

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name, headline, bio, avatar_url, roles, is_student, college, grad_year, location, timezone, links")
    .eq("id", user.id)
    .maybeSingle<ProfileRow>();

  return (
    <div className="flex flex-col items-center gap-8">
      <SettingsForm
        userId={user.id}
        initial={{
          username: profile?.username ?? username,
          displayName: profile?.display_name ?? null,
          headline: profile?.headline ?? null,
          bio: profile?.bio ?? null,
          avatarUrl: profile?.avatar_url ?? null,
          roles: profile?.roles ?? [],
          isStudent: profile?.is_student ?? false,
          college: profile?.college ?? null,
          gradYear: profile?.grad_year ?? null,
          location: profile?.location ?? null,
          timezone: profile?.timezone ?? null,
          links: profile?.links ?? {},
        }}
      />
      <div className="w-full max-w-[560px] border-t border-[var(--color-border-subtle)] pt-6">
        <SignOutButton />
      </div>
    </div>
  );
}
