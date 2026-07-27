import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import { requireOnboardedUser } from "@/lib/auth/session";
import { Composer } from "@/components/project/composer";

export const metadata: Metadata = {
  title: "Post a project — CoBuild",
};

// Reads cookies via the auth guard, and mints a fresh draft id per visit.
export const dynamic = "force-dynamic";

export default async function NewProjectPage() {
  const { user } = await requireOnboardedUser("/new");

  // The project id is minted here, before the row exists, so images can be
  // uploaded to `{userId}/{projectId}/…` while the user is still composing.
  // Abandoned drafts leave orphaned objects, which the cleanup job reaps.
  const draftId = randomUUID();

  return (
    <Composer
      userId={user.id}
      isNew
      initial={{
        id: draftId,
        title: "",
        tagline: "",
        description: "",
        liveUrl: "",
        repoUrl: "",
        status: "in_progress",
        visibility: "public",
        images: [],
        tags: [],
        collaborators: [],
      }}
    />
  );
}
