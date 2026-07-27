"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteProject } from "@cobuild/shared";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function DeleteProjectButton({
  projectId,
  authorId,
  title,
}: {
  projectId: string;
  authorId: string;
  title: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmDelete() {
    setDeleting(true);
    setError(null);

    try {
      // Goes through `packages/shared` rather than an inline `.delete()` so
      // mobile gets the same call. It also filters on `author_id` explicitly:
      // RLS already scopes the delete to the owner, but a DELETE whose only
      // ownership check lives in a policy is one policy edit away from being
      // a "delete any project by id" endpoint. Child rows (images, tags,
      // credits, votes, comments) cascade; storage objects are reaped by the
      // orphan cleanup job rather than deleted inline.
      await deleteProject(createClient(), projectId, authorId);
    } catch (e) {
      setDeleting(false);
      setError(e instanceof Error ? e.message : "Could not delete this project.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        className="rounded-[var(--radius-control)] border-[var(--color-status-danger)]/28 bg-[var(--color-status-danger)]/[0.07] px-4 py-2.5 text-[13px] font-semibold text-[var(--color-status-danger-strong)] hover:bg-[var(--color-status-danger)]/[0.14]"
      >
        Delete project
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border-[var(--color-border-default)] bg-[var(--color-bg-panel-alt)] sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Delete “{title}”?</DialogTitle>
            <DialogDescription className="text-[var(--color-text-secondary)]">
              This permanently removes the project, its screenshots, comments, and upvotes. This
              can&rsquo;t be undone.
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-[13px] text-[var(--color-status-danger-strong)]">{error}</p>}
          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={confirmDelete}
              disabled={deleting}
              className="bg-[var(--color-status-danger)] font-bold text-[#2a0d0d] hover:bg-[var(--color-status-danger-strong)]"
            >
              {deleting ? "Deleting…" : "Delete project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
