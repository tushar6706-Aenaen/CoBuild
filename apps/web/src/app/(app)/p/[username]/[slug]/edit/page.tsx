import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getProjectDetail, publicStorageUrl } from "@cobuild/shared";
import { createClient } from "@/lib/supabase/server";
import { requireOnboardedUser } from "@/lib/auth/session";
import { Composer } from "@/components/project/composer";
import type { ProjectStatus, ProjectVisibility } from "@cobuild/shared";

export const metadata: Metadata = {
  title: "Edit project — CoBuild",
};

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ username: string; slug: string }>;
}) {
  const { username, slug } = await params;
  const { user } = await requireOnboardedUser(`/p/${username}/${slug}/edit`);

  const supabase = await createClient();
  const project = await getProjectDetail(supabase, username, slug);
  if (!project) notFound();

  // RLS would block the write regardless, but bouncing here avoids showing a
  // fully populated editor that can't save.
  if (project.author.id !== user.id) redirect(`/p/${username}/${slug}`);

  return (
    <Composer
      userId={user.id}
      isNew={false}
      initial={{
        id: project.id,
        title: project.title,
        tagline: project.tagline ?? "",
        description: project.description ?? "",
        liveUrl: project.live_url ?? "",
        repoUrl: project.repo_url ?? "",
        status: project.status as ProjectStatus,
        visibility: project.visibility as ProjectVisibility,
        images: project.images.map((img) => ({
          storagePath: img.storage_path,
          url: publicStorageUrl(supabase, "project-media", img.storage_path)!,
          alt: img.alt ?? "",
          caption: img.caption ?? "",
          width: img.width,
          height: img.height,
        })),
        tags: project.tags,
        collaborators: project.collaborators.map((c) => ({
          profileId: c.profile_id,
          username: c.profile?.username ?? null,
          invitedName: c.invited_name,
          roleLabel: c.role_label ?? "",
        })),
      }}
    />
  );
}
