import { getUnreadNotificationCount, transformedStorageUrl } from "@cobuild/shared";
import { createClient } from "@/lib/supabase/server";
import { getAuthState } from "@/lib/auth/session";
import { Sidebar } from "@/components/shell/sidebar";
import { AppHeader } from "@/components/shell/app-header";
import { MobileNav } from "@/components/shell/mobile-nav";
import { mobileNav } from "@/components/shell/nav-items";
import { ToastViewport } from "@/components/ui/toast";

/**
 * Shell for every screen except sign-in/onboarding (`CoBuild.dc.html`'s
 * `isApp` branch — feed, detail, create, profile, board, search, tag,
 * notifs, bookmarks): a 246px desktop sidebar, a sticky header with the
 * search entry point, and a mobile bottom bar. Content is capped at 1080px,
 * matching `contentStyle` in the design file (not the 1040px an earlier
 * pass used).
 *
 * Every nav surface that shows the unread badge reads the count from here, so
 * it is fetched once per render rather than once per surface. The count query
 * is a `head: true` COUNT over `notifications_recipient_read_idx`, and it runs
 * alongside the profile lookup rather than after it — this is the app shell,
 * so it is on the critical path of every authenticated page.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, username } = await getAuthState();

  let avatarUrl: string | null = null;
  let displayName: string | null = null;
  let unreadCount = 0;

  if (user) {
    const supabase = await createClient();
    const [{ data }, unread] = await Promise.all([
      supabase
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("id", user.id)
        .maybeSingle<{ display_name: string | null; avatar_url: string | null }>(),
      getUnreadNotificationCount(supabase, user.id),
    ]);

    displayName = data?.display_name ?? null;
    unreadCount = unread;
    if (data?.avatar_url) {
      avatarUrl = transformedStorageUrl(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${data.avatar_url}`,
        { width: 40, height: 40, fit: "cover" },
      );
    }
  }

  const profileHref = username ? `/u/${username}` : null;

  return (
    <div className="flex min-h-screen">
      <Sidebar username={username} displayName={displayName} avatarUrl={avatarUrl} unreadCount={unreadCount} />

      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader username={username} avatarUrl={avatarUrl} unreadCount={unreadCount} signedIn={!!user} />
        <main className="mx-auto w-full max-w-[1080px] flex-1 px-5 pt-[26px] pb-[100px] lg:px-7 lg:pb-[60px]">
          {children}
        </main>
      </div>

      <MobileNav items={mobileNav(profileHref, !!user)} />
      <ToastViewport />
    </div>
  );
}
