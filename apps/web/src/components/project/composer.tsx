"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import {
  MAX_IMAGES,
  TAGLINE_MAX,
  TITLE_MAX,
  PROJECT_STATUSES,
  PROJECT_VISIBILITIES,
  searchTags,
  findOrCreateTag,
  searchProfiles,
  type ProjectStatus,
  type ProjectVisibility,
  type TagOption,
  type CollaboratorOption,
} from "@cobuild/shared";
import { compressImage, validateImageFile } from "@/lib/images/compress";
import { uploadProjectImage, removeProjectImage } from "@/lib/images/upload";
import { saveProjectAction } from "@/app/(app)/new/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MarkdownField } from "@/components/project/markdown-field";

type ImageSlot = {
  /** Stable key for React across reorder. */
  key: string;
  storagePath: string | null;
  previewUrl: string;
  alt: string;
  caption: string;
  width: number | null;
  height: number | null;
  uploading: boolean;
  progress: number;
  error: string | null;
};

export type ComposerInitial = {
  id: string;
  title: string;
  tagline: string;
  description: string;
  liveUrl: string;
  repoUrl: string;
  status: ProjectStatus;
  visibility: ProjectVisibility;
  images: { storagePath: string; url: string; alt: string; caption: string; width: number | null; height: number | null }[];
  tags: TagOption[];
  collaborators: { profileId: string | null; username: string | null; invitedName: string | null; roleLabel: string }[];
};

const STATUS_LABEL: Record<ProjectStatus, string> = {
  shipped: "Shipped",
  in_progress: "In progress",
  archived: "Archived",
};

const VISIBILITY_COPY: Record<ProjectVisibility, { label: string; hint: string; color: string }> = {
  public: { label: "Public", hint: "Shows in the feed, search, and leaderboards.", color: "var(--color-accent)" },
  unlisted: { label: "Unlisted", hint: "Anyone with the link can view it. Hidden from listings.", color: "var(--color-status-shipped)" },
  draft: { label: "Draft", hint: "Only you can see it.", color: "var(--color-text-tertiary)" },
};

export function Composer({
  userId,
  initial,
  isNew,
}: {
  userId: string;
  initial: ComposerInitial;
  isNew: boolean;
}) {
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  const [title, setTitle] = useState(initial.title);
  const [tagline, setTagline] = useState(initial.tagline);
  const [description, setDescription] = useState(initial.description);
  const [liveUrl, setLiveUrl] = useState(initial.liveUrl);
  const [repoUrl, setRepoUrl] = useState(initial.repoUrl);
  const [status, setStatus] = useState<ProjectStatus>(initial.status);
  const [visibility, setVisibility] = useState<ProjectVisibility>(initial.visibility);

  const [images, setImages] = useState<ImageSlot[]>(() =>
    initial.images.map((img, i) => ({
      key: `existing-${i}-${img.storagePath}`,
      storagePath: img.storagePath,
      previewUrl: img.url,
      alt: img.alt,
      caption: img.caption,
      width: img.width,
      height: img.height,
      uploading: false,
      progress: 100,
      error: null,
    })),
  );
  const [coverIndex, setCoverIndex] = useState(0);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const [tags, setTags] = useState<TagOption[]>(initial.tags);
  const [tagQuery, setTagQuery] = useState("");
  const [tagResults, setTagResults] = useState<TagOption[]>([]);

  const [crew, setCrew] = useState(initial.collaborators);
  const [crewQuery, setCrewQuery] = useState("");
  const [crewResults, setCrewResults] = useState<CollaboratorOption[]>([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllers = useRef(new Map<string, AbortController>());

  const uploadingCount = images.filter((i) => i.uploading).length;
  const taglineOver = tagline.length > TAGLINE_MAX;

  // Cancel any in-flight uploads if the composer unmounts mid-upload.
  useEffect(() => {
    const controllers = abortControllers.current;
    return () => {
      for (const c of controllers.values()) c.abort();
    };
  }, []);

  // --- Tag search -------------------------------------------------------
  useEffect(() => {
    const q = tagQuery.trim();
    if (!q) {
      setTagResults([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const results = await searchTags(supabase, q);
        if (!cancelled) setTagResults(results.filter((r) => !tags.some((t) => t.id === r.id)));
      } catch {
        if (!cancelled) setTagResults([]);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [tagQuery, tags, supabase]);

  // --- Co-builder search ------------------------------------------------
  useEffect(() => {
    const q = crewQuery.trim();
    if (!q) {
      setCrewResults([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const results = await searchProfiles(supabase, q, userId);
        if (!cancelled) {
          setCrewResults(results.filter((r) => !crew.some((c) => c.profileId === r.id)));
        }
      } catch {
        if (!cancelled) setCrewResults([]);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [crewQuery, crew, userId, supabase]);

  // --- Images -----------------------------------------------------------
  const handleFiles = useCallback(
    async (files: FileList) => {
      const room = MAX_IMAGES - images.length;
      if (room <= 0) return;
      const picked = Array.from(files).slice(0, room);

      for (const file of picked) {
        const validation = validateImageFile(file);
        const key = crypto.randomUUID();

        if (!validation.ok) {
          setImages((prev) => [
            ...prev,
            {
              key,
              storagePath: null,
              previewUrl: "",
              alt: "",
              caption: "",
              width: null,
              height: null,
              uploading: false,
              progress: 0,
              error: validation.reason,
            },
          ]);
          continue;
        }

        const previewUrl = URL.createObjectURL(file);
        setImages((prev) => [
          ...prev,
          {
            key,
            storagePath: null,
            previewUrl,
            alt: "",
            caption: "",
            width: null,
            height: null,
            uploading: true,
            progress: 0,
            error: null,
          },
        ]);

        const controller = new AbortController();
        abortControllers.current.set(key, controller);

        try {
          const uploaded = await uploadProjectImage({
            client: supabase,
            userId,
            projectId: initial.id,
            file,
            signal: controller.signal,
            onProgress: (pct) =>
              setImages((prev) => prev.map((i) => (i.key === key ? { ...i, progress: pct } : i))),
          });
          setImages((prev) =>
            prev.map((i) =>
              i.key === key
                ? {
                    ...i,
                    storagePath: uploaded.storagePath,
                    width: uploaded.width,
                    height: uploaded.height,
                    uploading: false,
                    progress: 100,
                  }
                : i,
            ),
          );
        } catch (err) {
          if (controller.signal.aborted) {
            setImages((prev) => prev.filter((i) => i.key !== key));
          } else {
            const message = err instanceof Error ? err.message : "Upload failed.";
            setImages((prev) =>
              prev.map((i) => (i.key === key ? { ...i, uploading: false, error: message } : i)),
            );
          }
        } finally {
          abortControllers.current.delete(key);
        }
      }
    },
    [images.length, initial.id, supabase, userId],
  );

  function removeImage(index: number) {
    const slot = images[index];
    abortControllers.current.get(slot.key)?.abort();
    abortControllers.current.delete(slot.key);
    if (slot.storagePath) void removeProjectImage(supabase, slot.storagePath).catch(() => {});
    if (slot.previewUrl.startsWith("blob:")) URL.revokeObjectURL(slot.previewUrl);

    setImages((prev) => prev.filter((_, i) => i !== index));
    setCoverIndex((c) => (index === c ? 0 : index < c ? c - 1 : c));
  }

  function reorder(from: number, to: number) {
    if (from === to) return;
    setImages((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setCoverIndex((c) => {
      if (c === from) return to;
      if (from < c && to >= c) return c - 1;
      if (from > c && to <= c) return c + 1;
      return c;
    });
  }

  function patchImage(index: number, patch: Partial<ImageSlot>) {
    setImages((prev) => prev.map((img, i) => (i === index ? { ...img, ...patch } : img)));
  }

  // --- Save -------------------------------------------------------------
  async function save(nextVisibility: ProjectVisibility) {
    if (saving || uploadingCount > 0) return;
    setSaving(true);
    setError(null);

    const usable = images.filter((i) => i.storagePath && !i.error);
    const payload = {
      id: initial.id,
      title,
      tagline,
      description,
      liveUrl,
      repoUrl,
      status,
      visibility: nextVisibility,
      coverIndex: Math.min(coverIndex, Math.max(usable.length - 1, 0)),
      images: usable.map((i) => ({
        storagePath: i.storagePath!,
        alt: i.alt,
        caption: i.caption,
        width: i.width,
        height: i.height,
      })),
      tagIds: tags.map((t) => t.id),
      collaborators: crew.map((c) => ({
        profileId: c.profileId,
        invitedName: c.invitedName,
        roleLabel: c.roleLabel,
      })),
    };

    const result = await saveProjectAction(payload, isNew);
    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    setVisibility(nextVisibility);
    router.push(`/p/${result.username}/${result.slug}`);
    router.refresh();
  }

  /*
   * Everything the composer holds — title, tagline, a long description, up to
   * eight uploads with their alt text and captions, tags, credits — lives in
   * component state and nowhere else. Closing the tab used to take all of it
   * with no warning.
   *
   * Dirtiness is a signature comparison rather than a per-field flag so that
   * editing one image's alt text counts, and so that undoing an edit back to
   * its original value correctly stops counting.
   *
   * Caveat: `beforeunload` only covers tab close, reload, and navigation off
   * the origin. Next's App Router has no stable client-side route-change
   * guard, so an in-app <Link> back to the feed still discards silently.
   */
  const signature = JSON.stringify({
    title,
    tagline,
    description,
    liveUrl,
    repoUrl,
    status,
    coverIndex,
    images: images.map((i) => ({ p: i.storagePath, a: i.alt, c: i.caption })),
    tags: tags.map((t) => t.id),
    crew: crew.map((c) => ({ p: c.profileId, n: c.invitedName, r: c.roleLabel })),
  });
  const initialSignature = useRef<string | null>(null);
  if (initialSignature.current === null) initialSignature.current = signature;
  const dirty = initialSignature.current !== signature;

  useEffect(() => {
    if (!dirty || saving) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Older browsers require returnValue to be set; the string is ignored
      // and the browser shows its own wording.
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, saving]);

  const panel =
    "flex flex-col gap-4 rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-bg-panel)] p-5";
  const field =
    "rounded-[var(--radius-control)] border-[var(--color-border-default)] bg-[var(--color-bg-input)] py-3 text-sm";
  const labelCls = "text-[12.5px] font-semibold text-[var(--color-text-secondary-alt)]";

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-[22px]">
      <div className="flex flex-col gap-1.5">
        <span className="font-mono text-[11px] tracking-[0.12em] text-[var(--color-accent)]">
          {isNew ? "NEW PROJECT" : `EDITING · ${VISIBILITY_COPY[visibility].label.toUpperCase()}`}
        </span>
        <h1 className="text-[28px] font-extrabold tracking-tight">
          {isNew ? "Post a project" : "Edit project"}
        </h1>
      </div>

      {/* Basics */}
      <div className={panel}>
        <div className="flex flex-col gap-2">
          <Label htmlFor="title" className={labelCls}>Title</Label>
          <Input id="title" value={title} maxLength={TITLE_MAX} onChange={(e) => setTitle(e.target.value)} placeholder="Kerbside" className={field} />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <Label htmlFor="tagline" className={labelCls}>Tagline</Label>
            <span className={`font-mono text-[11px] ${taglineOver ? "text-[var(--color-status-danger)]" : "text-[var(--color-text-tertiary)]"}`}>
              {tagline.length} / {TAGLINE_MAX}
            </span>
          </div>
          <Input
            id="tagline"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            placeholder="One line on what it does and who it's for"
            className={taglineOver ? `${field} border-[var(--color-status-danger)]/55` : field}
          />
          {taglineOver && (
            <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--color-status-danger)]">
              Taglines must be {TAGLINE_MAX} characters or fewer.
            </div>
          )}
        </div>

        <MarkdownField id="description" value={description} onChange={setDescription} />
      </div>

      {/* Screenshots */}
      <div className={panel}>
        <div className="flex items-baseline justify-between gap-2.5">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-bold">Screenshots</span>
            <span className="text-xs text-[var(--color-text-tertiary)]">
              Drag to reorder. The first image is the cover. Max {MAX_IMAGES}.
            </span>
          </div>
          <span className="font-mono text-[11.5px] text-[var(--color-text-secondary)]">
            {images.length} / {MAX_IMAGES}
          </span>
        </div>

        <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
          {images.map((img, index) => (
            <div
              key={img.key}
              draggable={!img.uploading}
              onDragStart={() => setDragIndex(index)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragIndex !== null) reorder(dragIndex, index);
                setDragIndex(null);
              }}
              onDragEnd={() => setDragIndex(null)}
              className={`flex flex-col overflow-hidden rounded-[7px] border bg-[var(--color-bg-panel-alt)] ${
                index === coverIndex ? "border-[var(--color-accent)]/50" : "border-[var(--color-border-default)]"
              } ${dragIndex === index ? "opacity-50" : ""}`}
            >
              <div className="relative aspect-[16/10] bg-[repeating-linear-gradient(135deg,var(--color-bg-raised)_0_8px,var(--color-bg-panel-alt)_8px_16px)]">
                {img.previewUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={img.previewUrl} alt="" className="h-full w-full object-cover" />
                )}
                <span className="absolute top-1.5 left-1.5 flex cursor-grab items-center gap-1 rounded-[3px] bg-[rgb(var(--color-bg-page-rgb)/0.72)] px-1.5 py-1 font-mono text-[9.5px] text-[var(--color-text-secondary)]">
                  ⠿ {index + 1}
                </span>
                {index === coverIndex && (
                  <span className="absolute top-1.5 right-1.5 rounded-[3px] bg-[var(--color-accent)] px-1.5 py-1 text-[9.5px] font-bold tracking-wide text-[var(--color-accent-on)]">
                    COVER
                  </span>
                )}
                {img.uploading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[rgb(var(--color-bg-page-rgb)/0.78)]">
                    <span className="font-mono text-[10.5px] text-[var(--color-accent-muted)]">{img.progress}%</span>
                    <div className="h-1 w-[70%] overflow-hidden rounded-full bg-[var(--color-bg-raised)]">
                      <div className="h-full bg-[var(--color-accent)] transition-[width]" style={{ width: `${img.progress}%` }} />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-1.5 p-2">
                {img.error ? (
                  <span className="text-[11px] text-[var(--color-status-danger)]">{img.error}</span>
                ) : (
                  <>
                    <input
                      value={img.alt}
                      onChange={(e) => patchImage(index, { alt: e.target.value })}
                      placeholder="Alt text (required)"
                      className="rounded-[4px] border border-[var(--color-border-default)] bg-[var(--color-bg-input)] px-2 py-1.5 text-[11.5px] text-[var(--color-text-secondary)] outline-none placeholder:text-[var(--color-text-placeholder)] focus:border-[var(--color-accent)]/60"
                    />
                    <input
                      value={img.caption}
                      onChange={(e) => patchImage(index, { caption: e.target.value })}
                      placeholder="Caption"
                      className="rounded-[4px] border border-[var(--color-border-default)] bg-[var(--color-bg-input)] px-2 py-1.5 text-[11.5px] text-[var(--color-text-secondary)] outline-none placeholder:text-[var(--color-text-placeholder)] focus:border-[var(--color-accent)]/60"
                    />
                  </>
                )}
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCoverIndex(index)}
                    disabled={index === coverIndex || !img.storagePath}
                    className={
                      index === coverIndex
                        ? "flex-1 rounded-[4px] bg-[var(--color-accent)]/15 py-1.5 text-[11px] font-semibold text-[var(--color-accent-muted)]"
                        : "flex-1 rounded-[4px] border border-[var(--color-border-default)] bg-[var(--color-bg-panel-alt)] py-1.5 text-[11px] font-semibold text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-bg-raised)] hover:text-[var(--color-text-primary)] disabled:opacity-40"
                    }
                  >
                    Cover
                  </button>
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    aria-label="Remove image"
                    className="w-7 rounded-[4px] border border-[var(--color-status-danger)]/25 bg-[var(--color-status-danger)]/[0.07] py-1.5 text-[11px] text-[var(--color-status-danger-strong)]"
                  >
                    ×
                  </button>
                </div>
              </div>
            </div>
          ))}

          {images.length < MAX_IMAGES && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex min-h-[130px] flex-col items-center justify-center gap-2 rounded-[7px] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-bg-input)] text-xs font-semibold text-[var(--color-text-secondary)] hover:border-[var(--color-accent)]/60 hover:text-[var(--color-text-primary)]"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Add images
              <span className="font-mono text-[9.5px] text-[var(--color-text-placeholder)]">PNG · JPG · WEBP · GIF</span>
            </button>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) void handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {/* Links, tags, status, crew, visibility */}
      <div className={panel}>
        <div className="flex flex-col gap-2">
          <Label htmlFor="liveUrl" className={labelCls}>Live demo URL</Label>
          <Input id="liveUrl" value={liveUrl} onChange={(e) => setLiveUrl(e.target.value)} placeholder="https://kerbside.app" className={`${field} font-mono text-[13px]`} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="repoUrl" className={labelCls}>GitHub repo</Label>
          <Input id="repoUrl" value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} placeholder="github.com/you/kerbside" className={`${field} font-mono text-[13px]`} />
        </div>

        {/* Tech stack */}
        <div className="flex flex-col gap-2">
          <Label className={labelCls}>Tech stack</Label>
          <div className="flex flex-wrap gap-2 rounded-[var(--radius-control)] border border-[var(--color-border-default)] bg-[var(--color-bg-input)] p-2.5">
            {tags.map((t) => (
              <span key={t.id} className="flex items-center gap-1.5 rounded border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/14 px-2 py-1 font-mono text-[11.5px] text-[var(--color-accent-muted-strong)]">
                {t.name}
                <button type="button" onClick={() => setTags((prev) => prev.filter((x) => x.id !== t.id))} aria-label={`Remove ${t.name}`} className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]">×</button>
              </span>
            ))}
            <input
              value={tagQuery}
              onChange={(e) => setTagQuery(e.target.value)}
              placeholder="Search or create a tag…"
              className="min-w-[150px] flex-1 bg-transparent p-1 font-mono text-[12.5px] text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-placeholder)]"
            />
          </div>
          {tagQuery.trim() && (
            <div className="flex flex-col gap-0.5 rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-[var(--color-bg-panel-alt)] p-1.5">
              {tagResults.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setTags((prev) => [...prev, t]);
                    setTagQuery("");
                  }}
                  className="flex items-center justify-between gap-2.5 rounded-[5px] px-2.5 py-2 text-left font-mono text-[12.5px] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-raised)]"
                >
                  {t.name}
                  <span className="text-[11px] text-[var(--color-text-tertiary)]">{t.usage_count}</span>
                </button>
              ))}
              <button
                type="button"
                onClick={async () => {
                  try {
                    const created = await findOrCreateTag(supabase, tagQuery.trim());
                    setTags((prev) => (prev.some((x) => x.id === created.id) ? prev : [...prev, created]));
                    setTagQuery("");
                  } catch {
                    setError("Couldn't create that tag.");
                  }
                }}
                className="rounded-[5px] px-2.5 py-2 text-left text-[12.5px] font-semibold text-[var(--color-accent-muted)] hover:bg-[var(--color-bg-raised)]"
              >
                + Create &ldquo;{tagQuery.trim()}&rdquo;
              </button>
            </div>
          )}
        </div>

        {/* Status */}
        <div className="flex flex-col gap-2">
          <Label className={labelCls}>Status</Label>
          <div className="flex flex-wrap gap-2">
            {PROJECT_STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={
                  status === s
                    ? "rounded-[var(--radius-control)] border border-[var(--color-accent)]/45 bg-[var(--color-accent)]/12 px-3.5 py-2 text-[13px] font-semibold text-[var(--color-accent-muted)]"
                    : "rounded-[var(--radius-control)] border border-[var(--color-border-default)] bg-[var(--color-bg-input)] px-3.5 py-2 text-[13px] font-semibold text-[var(--color-text-secondary)]"
                }
              >
                {STATUS_LABEL[s]}
              </button>
            ))}
          </div>
          {status === "shipped" && !liveUrl.trim() && (
            <span className="text-[11.5px] text-[var(--color-status-in-progress)]">
              A shipped project needs a live demo URL before it can be published.
            </span>
          )}
        </div>

        {/* Co-builders */}
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-0.5">
            <Label className={labelCls}>Credit co-builders</Label>
            <span className="text-[11.5px] text-[var(--color-text-tertiary)]">
              They get the project on their Contributions tab.
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {crew.map((c, i) => (
              <div key={`${c.profileId ?? c.invitedName}-${i}`} className="flex items-center gap-2.5 rounded-[var(--radius-control)] border border-[var(--color-border-default)] bg-[var(--color-bg-input)] px-3 py-2.5">
                <span className="flex-1 font-mono text-[12.5px] text-[var(--color-text-primary)]">
                  {c.username ? `@${c.username}` : c.invitedName}
                </span>
                <input
                  value={c.roleLabel}
                  onChange={(e) =>
                    setCrew((prev) => prev.map((x, xi) => (xi === i ? { ...x, roleLabel: e.target.value } : x)))
                  }
                  placeholder="Role"
                  className="w-[110px] rounded-[4px] border border-[var(--color-border-default)] bg-[var(--color-bg-page)] px-2 py-1.5 text-[11.5px] font-semibold text-[var(--color-accent-muted-strong)] outline-none placeholder:text-[var(--color-text-placeholder)]"
                />
                <button type="button" onClick={() => setCrew((prev) => prev.filter((_, xi) => xi !== i))} aria-label="Remove collaborator" className="px-1 text-base text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]">×</button>
              </div>
            ))}
            <Input value={crewQuery} onChange={(e) => setCrewQuery(e.target.value)} placeholder="Search a username to credit…" className={field} />
            {crewQuery.trim() && crewResults.length > 0 && (
              <div className="flex flex-col gap-0.5 rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-[var(--color-bg-panel-alt)] p-1.5">
                {crewResults.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setCrew((prev) => [...prev, { profileId: p.id, username: p.username, invitedName: null, roleLabel: "" }]);
                      setCrewQuery("");
                    }}
                    className="rounded-[5px] px-2.5 py-2 text-left font-mono text-[12.5px] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-raised)]"
                  >
                    @{p.username}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Visibility */}
        <div className="flex flex-col gap-2">
          <Label className={labelCls}>Visibility</Label>
          <div className="flex flex-col gap-2">
            {PROJECT_VISIBILITIES.map((v) => {
              const copy = VISIBILITY_COPY[v];
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVisibility(v)}
                  className={`flex items-center gap-3 rounded-[var(--radius-control)] border px-3.5 py-3 text-left ${
                    visibility === v
                      ? "border-[var(--color-accent)]/45 bg-[var(--color-accent)]/[0.08]"
                      : "border-[var(--color-border-default)] bg-[var(--color-bg-input)]"
                  }`}
                >
                  <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: visibility === v ? copy.color : "transparent", border: `2px solid ${copy.color}` }} />
                  <span className="flex flex-col gap-0.5">
                    <span className="text-[13.5px] font-semibold text-[var(--color-text-primary)]">{copy.label}</span>
                    <span className="text-[11.5px] text-[var(--color-text-tertiary)]">{copy.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {error && <p className="text-[13px] text-[var(--color-status-danger-strong)]">{error}</p>}

      {/* Sticky action bar */}
      <div className="sticky bottom-0 flex flex-wrap items-center gap-2.5 rounded-[8px] border border-[var(--color-border-default)] bg-[rgb(var(--color-bg-panel-rgb)/0.92)] p-3.5 backdrop-blur-md">
        <div className="flex-1" />
        {uploadingCount > 0 && (
          <span className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-[var(--color-border-strong)] border-t-[var(--color-accent)]" />
            {uploadingCount} image{uploadingCount > 1 ? "s" : ""} uploading
          </span>
        )}
        <Button
          type="button"
          variant="outline"
          disabled={saving || uploadingCount > 0 || !title.trim()}
          onClick={() => save("draft")}
          className="rounded-[var(--radius-control)] border-[var(--color-border-strong)] bg-[var(--color-bg-panel-alt)] px-4 py-2.5 text-[13.5px] font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-bg-raised)]"
        >
          Save draft
        </Button>
        <Button
          type="button"
          disabled={saving || uploadingCount > 0 || !title.trim() || taglineOver}
          onClick={() => save(visibility === "draft" ? "public" : visibility)}
          className="rounded-[var(--radius-control)] bg-[var(--color-accent)] px-5 py-2.5 text-[13.5px] font-bold text-[var(--color-accent-on)] hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
        >
          {saving ? "Saving…" : isNew ? "Publish" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
