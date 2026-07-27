import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAuthState } from "@/lib/auth/session";
import { LOGIN_PATH, sanitizeNextPath } from "@/lib/auth/redirects";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = {
  title: "Claim your handle — CoBuild",
};

type ProfileRow = {
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  roles: string[];
  is_student: boolean;
  college: string | null;
  grad_year: number | null;
};

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next: nextParam } = await searchParams;
  const next = sanitizeNextPath(nextParam);

  // The proxy already gates this route, but every authenticated page must
  // check independently — matcher refactors can silently drop proxy coverage.
  const { user, username, needsOnboarding } = await getAuthState();
  if (!user) redirect(`${LOGIN_PATH}?next=${encodeURIComponent("/onboarding")}`);
  if (!needsOnboarding) redirect(next);

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, bio, avatar_url, roles, is_student, college, grad_year")
    .eq("id", user.id)
    .maybeSingle<ProfileRow>();

  return (
    <main
      className="flex min-h-screen items-center justify-center px-5 py-10"
      style={{
        background:
          "radial-gradient(900px 520px at 50% -10%, rgba(59,227,143,0.16), transparent 70%), var(--color-bg-page)",
      }}
    >
      <OnboardingForm
        userId={user.id}
        next={next}
        initial={{
          username: username ?? null,
          displayName: profile?.display_name ?? null,
          bio: profile?.bio ?? null,
          avatarUrl: profile?.avatar_url ?? null,
          roles: profile?.roles ?? [],
          isStudent: profile?.is_student ?? false,
          college: profile?.college ?? null,
          gradYear: profile?.grad_year ?? null,
        }}
      />
    </main>
  );
}
