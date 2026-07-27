"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Records a view via the `record_project_view` RPC.
 *
 * The RPC is the ONLY way to write `project_views` — the table has RLS with no
 * client policies (PROJECT_INFO). It dedupes per (project, viewer, day) and
 * only increments the counter on a genuinely new row, so re-firing is harmless.
 *
 * For signed-in callers the RPC ignores the key we pass and forces
 * `auth.uid()`, so a logged-in user can't inflate a count by cycling keys.
 * The random key below therefore only ever applies to anonymous views; it's
 * kept in sessionStorage so a reload within a session isn't counted twice.
 */
export function ViewTracker({ projectId }: { projectId: string }) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;

    const STORAGE_KEY = "cobuild:viewer-key";
    let viewerKey: string;
    try {
      viewerKey = sessionStorage.getItem(STORAGE_KEY) ?? crypto.randomUUID();
      sessionStorage.setItem(STORAGE_KEY, viewerKey);
    } catch {
      // Private mode / storage disabled — a per-load key is an acceptable
      // fallback; the server-side dedupe still bounds it to one row per day
      // for signed-in users.
      viewerKey = crypto.randomUUID();
    }

    const supabase = createClient();
    void supabase
      .rpc("record_project_view", { p_project_id: projectId, p_viewer_key: viewerKey })
      .then(({ error }) => {
        if (error) console.warn("[view-tracker] failed", error.message);
      });
  }, [projectId]);

  return null;
}
