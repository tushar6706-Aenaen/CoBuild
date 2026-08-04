"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import {
  validateUsername,
  usernameIsTaken,
  DISPLAY_NAME_MAX,
  HEADLINE_MAX,
  BIO_MAX,
  LOCATION_MAX,
  TIMEZONE_MAX,
  COLLEGE_MAX,
} from "@cobuild/shared";
import { FieldCounter } from "@/components/ui/field-counter";
import { updateProfile, type SettingsState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

type InitialProfile = {
  username: string;
  displayName: string | null;
  headline: string | null;
  bio: string | null;
  avatarUrl: string | null;
  roles: string[];
  isStudent: boolean;
  college: string | null;
  gradYear: number | null;
  location: string | null;
  timezone: string | null;
  links: Record<string, string>;
};

const ROLE_CHIPS = [
  { value: "developer", label: "Developer" },
  { value: "designer", label: "Designer" },
  { value: "founder", label: "Founder" },
  { value: "other", label: "Other" },
] as const;

const LINK_FIELDS = [
  { key: "github", label: "GitHub", placeholder: "https://github.com/you" },
  { key: "website", label: "Website", placeholder: "https://you.dev" },
  { key: "x", label: "X", placeholder: "https://x.com/you" },
  { key: "linkedin", label: "LinkedIn", placeholder: "https://linkedin.com/in/you" },
  { key: "behance", label: "Behance", placeholder: "https://behance.net/you" },
  { key: "dribbble", label: "Dribbble", placeholder: "https://dribbble.com/you" },
  { key: "figma", label: "Figma", placeholder: "https://figma.com/@you" },
] as const;

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

function extensionFor(file: File): string {
  if (file.type === "image/png") return "png";
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

type UsernameStatus = "idle" | "checking" | "ok" | "bad" | "taken" | "error";

export function SettingsForm({ userId, initial }: { userId: string; initial: InitialProfile }) {
  const initialState: SettingsState = {};
  const [state, formAction, pending] = useActionState(updateProfile, initialState);
  const toast = useToast();

  /*
   * Confirm in place, and deliberately do not navigate.
   *
   * Saving used to redirect to /u/[username], which only ever confirmed the
   * fields that page renders — change a timezone or clear a link and the
   * result was indistinguishable from having done nothing. Two attempts to
   * carry a confirmation across that redirect (a `?saved=1` flag, then a
   * client-side push) both failed the same way: the toast is queued, and the
   * navigation immediately re-renders the tree that owns the queue, so the
   * message is destroyed before it can paint.
   *
   * Staying put fixes it by removing the race, and is the better behaviour
   * anyway — a settings screen that throws you somewhere else on save is
   * surprising, and you often want to keep editing.
   *
   * Depends on `state` by identity: useActionState returns a fresh object per
   * submission, so saving twice confirms twice.
   */
  useEffect(() => {
    if (!state.savedUsername) return;
    toast("Profile saved.");
  }, [state, toast]);
  const [supabase] = useState(() => createClient());

  const [username, setUsername] = useState(initial.username);
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("idle");
  const [usernameMessage, setUsernameMessage] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Bumped by "Check again" to re-run the availability lookup. */
  const [checkNonce, setCheckNonce] = useState(0);

  const [avatarPath, setAvatarPath] = useState(initial.avatarUrl ?? "");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    initial.avatarUrl ? supabase.storage.from("avatars").getPublicUrl(initial.avatarUrl).data.publicUrl : null,
  );
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const [roles, setRoles] = useState<Set<string>>(new Set(initial.roles.filter((r) => r !== "student")));
  const [isStudent, setIsStudent] = useState(initial.isStudent);

  // Controlled purely so the counters can read length. The server truncates at
  // the same caps; `maxLength` is what stops the text being lost in the first
  // place.
  const [displayName, setDisplayName] = useState(initial.displayName ?? "");
  const [headline, setHeadline] = useState(initial.headline ?? "");
  const [bio, setBio] = useState(initial.bio ?? "");

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const candidate = username.trim();
    if (!candidate) {
      setUsernameStatus("idle");
      return;
    }
    if (candidate.toLowerCase() === initial.username.toLowerCase()) {
      setUsernameStatus("idle");
      return;
    }

    const format = validateUsername(candidate);
    if (!format.ok) {
      setUsernameStatus("bad");
      setUsernameMessage(format.reason);
      return;
    }

    setUsernameStatus("checking");
    debounceRef.current = setTimeout(async () => {
      try {
        const taken = await usernameIsTaken(supabase, format.username);
        setUsername((current) => {
          if (current.trim() !== candidate) return current;
          if (taken) {
            setUsernameStatus("taken");
            setUsernameMessage("That username is taken.");
          } else {
            setUsernameStatus("ok");
            setUsernameMessage("Available.");
          }
          return current;
        });
      } catch {
        // Silently falling back to "idle" left the user with no hint that
        // their new handle was never actually checked — they'd submit and
        // meet the server's rejection at the bottom of a long form. Submitting
        // stays allowed (the server re-checks, and the column is unique); this
        // just stops the failure being invisible.
        setUsernameStatus("error");
        setUsernameMessage("Couldn't check availability — we'll confirm when you save.");
      }
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, checkNonce]);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarError(null);

    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setAvatarError("PNG, JPG, or WEBP only.");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setAvatarError("Must be under 2 MB.");
      return;
    }

    setAvatarUploading(true);
    setAvatarPreview(URL.createObjectURL(file));

    const path = `${userId}/avatar.${extensionFor(file)}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, {
      contentType: file.type,
      upsert: true,
    });

    setAvatarUploading(false);
    if (error) {
      setAvatarError(error.message);
      return;
    }
    setAvatarPath(path);
  }

  const canSubmit = usernameStatus !== "bad" && usernameStatus !== "taken" && !avatarUploading && !pending;

  return (
    <form action={formAction} className="flex w-full max-w-[560px] flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-[24px] font-extrabold tracking-tight">Edit profile</h1>
        <p className="text-sm text-[var(--color-text-secondary)]">
          This is what shows on your public portfolio page.
        </p>
      </div>

      <div className="flex flex-col gap-5 rounded-[var(--radius-card)] border border-[var(--color-border-default)] bg-[var(--color-bg-panel-alt)] p-6">
        <div className="flex flex-col gap-2">
          <Label htmlFor="username" className="text-[12.5px] font-semibold text-[var(--color-text-secondary-alt)]">
            Username
          </Label>
          <div className="flex items-center overflow-hidden rounded-[var(--radius-control)] border border-[var(--color-border-default)] bg-[var(--color-bg-input)]">
            <span className="py-3 pl-3.5 font-mono text-[13.5px] text-[var(--color-text-placeholder)]">
              cobuild.to/u/
            </span>
            <input
              id="username"
              name="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="off"
              className="flex-1 border-none bg-transparent py-3 pr-3.5 font-mono text-[13.5px] text-[var(--color-text-primary)] outline-none"
            />
          </div>
          {usernameStatus === "ok" && (
            <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--color-status-shipped)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-status-shipped)]" />
              {usernameMessage}
            </div>
          )}
          {(usernameStatus === "bad" || usernameStatus === "taken") && (
            <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--color-status-danger)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-status-danger)]" />
              {usernameMessage}
            </div>
          )}
          {usernameStatus === "error" && (
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12.5px] text-[var(--color-status-danger)]">
              <span className="flex items-center gap-1.5 font-semibold">
                <span className="h-1.5 w-1.5 flex-none rounded-full bg-[var(--color-status-danger)]" />
                {usernameMessage}
              </span>
              <button
                type="button"
                onClick={() => setCheckNonce((n) => n + 1)}
                className="font-semibold text-[var(--color-text-primary)] underline underline-offset-2 transition-colors hover:text-[var(--color-accent-muted)]"
              >
                Check again
              </button>
            </div>
          )}
          {usernameStatus === "checking" && (
            <div className="flex items-center gap-2 text-[12.5px] text-[var(--color-text-secondary)]">
              <span className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-[var(--color-border-strong)] border-t-[var(--color-accent)]" />
              Checking availability…
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="relative h-16 w-16 flex-none overflow-hidden rounded-full border border-dashed border-[var(--color-border-strong)] bg-[repeating-linear-gradient(135deg,var(--color-bg-raised)_0_5px,var(--color-bg-panel-alt)_5px_10px)]">
            {avatarPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarPreview} alt="Avatar preview" className="h-full w-full object-cover" />
            ) : (
              <span className="absolute inset-0 flex items-center justify-center font-mono text-[9px] text-[var(--color-text-tertiary)]">
                AVATAR
              </span>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Button asChild variant="outline" size="sm" className="w-fit border-[var(--color-border-strong)] bg-[var(--color-bg-panel-alt)] text-[12.5px] font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-bg-raised)]">
              <label htmlFor="avatar-input" className="cursor-pointer">
                {avatarUploading ? "Uploading…" : "Change image"}
                <input
                  id="avatar-input"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
              </label>
            </Button>
            <span className="text-[11.5px] text-[var(--color-text-tertiary)]">PNG or JPG, square, up to 2 MB</span>
            {avatarError && <span className="text-[11.5px] text-[var(--color-status-danger)]">{avatarError}</span>}
          </div>
        </div>
        <input type="hidden" name="avatarPath" value={avatarPath} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="displayName" className="text-[12.5px] font-semibold text-[var(--color-text-secondary-alt)]">
              Display name
            </Label>
            <Input id="displayName" name="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={DISPLAY_NAME_MAX} className="rounded-[var(--radius-control)] border-[var(--color-border-default)] bg-[var(--color-bg-input)] py-3 text-sm" />
            <FieldCounter value={displayName} max={DISPLAY_NAME_MAX} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="headline" className="text-[12.5px] font-semibold text-[var(--color-text-secondary-alt)]">
              Headline
            </Label>
            <Input id="headline" name="headline" value={headline} onChange={(e) => setHeadline(e.target.value)} maxLength={HEADLINE_MAX} placeholder="Full-stack developer" className="rounded-[var(--radius-control)] border-[var(--color-border-default)] bg-[var(--color-bg-input)] py-3 text-sm" />
            <FieldCounter value={headline} max={HEADLINE_MAX} />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="bio" className="text-[12.5px] font-semibold text-[var(--color-text-secondary-alt)]">
            Bio
          </Label>
          <Textarea id="bio" name="bio" rows={3} value={bio} onChange={(e) => setBio(e.target.value)} maxLength={BIO_MAX} className="resize-y rounded-[var(--radius-control)] border-[var(--color-border-default)] bg-[var(--color-bg-input)] text-sm" />
          <FieldCounter value={bio} max={BIO_MAX} />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="location" className="text-[12.5px] font-semibold text-[var(--color-text-secondary-alt)]">
              Location
            </Label>
            <Input id="location" name="location" defaultValue={initial.location ?? ""} maxLength={LOCATION_MAX} placeholder="Boston, MA" className="rounded-[var(--radius-control)] border-[var(--color-border-default)] bg-[var(--color-bg-input)] py-3 text-sm" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="timezone" className="text-[12.5px] font-semibold text-[var(--color-text-secondary-alt)]">
              Timezone
            </Label>
            <Input id="timezone" name="timezone" defaultValue={initial.timezone ?? ""} maxLength={TIMEZONE_MAX} placeholder="America/New_York" className="rounded-[var(--radius-control)] border-[var(--color-border-default)] bg-[var(--color-bg-input)] py-3 font-mono text-sm" />
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <Label className="text-[12.5px] font-semibold text-[var(--color-text-secondary-alt)]">I am a…</Label>
          <div className="flex flex-wrap gap-2">
            {ROLE_CHIPS.map((chip) => {
              const active = roles.has(chip.value);
              return (
                <button
                  key={chip.value}
                  type="button"
                  onClick={() =>
                    setRoles((prev) => {
                      const updated = new Set(prev);
                      if (updated.has(chip.value)) updated.delete(chip.value);
                      else updated.add(chip.value);
                      return updated;
                    })
                  }
                  className={
                    active
                      ? "rounded-[var(--radius-control)] border border-[var(--color-accent)]/45 bg-[var(--color-accent)]/12 px-3.5 py-2 text-[13px] font-semibold text-[var(--color-accent-muted)]"
                      : "rounded-[var(--radius-control)] border border-[var(--color-border-default)] bg-[var(--color-bg-input)] px-3.5 py-2 text-[13px] font-semibold text-[var(--color-text-secondary)]"
                  }
                >
                  {chip.label}
                </button>
              );
            })}
          </div>
          {[...roles].map((r) => (
            <input key={r} type="hidden" name="roles" value={r} />
          ))}
        </div>

        <div className="flex flex-col gap-3.5 pt-1">
          <div className="flex items-center justify-between gap-3.5">
            <div className="flex flex-col gap-0.5">
              <span className="text-[13.5px] font-semibold">I&rsquo;m a student</span>
              <span className="text-xs text-[var(--color-text-tertiary)]">Shows a student badge on your profile</span>
            </div>
            <Switch name="isStudent" checked={isStudent} onCheckedChange={setIsStudent} className="data-[state=checked]:bg-[var(--color-accent)]" />
          </div>
          {isStudent && (
            <div className="grid grid-cols-[1fr_130px] gap-2.5">
              <Input name="college" placeholder="College" defaultValue={initial.college ?? ""} maxLength={COLLEGE_MAX} className="rounded-[var(--radius-control)] border-[var(--color-border-default)] bg-[var(--color-bg-input)] py-3 text-sm" />
              <Input name="gradYear" placeholder="Year" type="number" defaultValue={initial.gradYear ?? undefined} className="rounded-[var(--radius-control)] border-[var(--color-border-default)] bg-[var(--color-bg-input)] py-3 font-mono text-sm" />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-[var(--color-border-subtle)] pt-4">
          <Label className="text-[12.5px] font-semibold text-[var(--color-text-secondary-alt)]">Links</Label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {LINK_FIELDS.map((field) => (
              <div key={field.key} className="flex flex-col gap-1.5">
                <Label htmlFor={`link_${field.key}`} className="text-[11.5px] text-[var(--color-text-tertiary)]">
                  {field.label}
                </Label>
                <Input
                  id={`link_${field.key}`}
                  name={`link_${field.key}`}
                  type="url"
                  defaultValue={initial.links[field.key] ?? ""}
                  placeholder={field.placeholder}
                  className="rounded-[var(--radius-control)] border-[var(--color-border-default)] bg-[var(--color-bg-input)] py-2.5 text-[13px]"
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {state.error && <p className="text-[13px] text-[var(--color-status-danger-strong)]">{state.error}</p>}

      <Button
        type="submit"
        disabled={!canSubmit}
        className="rounded-[var(--radius-control-lg)] bg-[var(--color-accent)] py-3.5 text-[15px] font-bold text-[var(--color-accent-on)] shadow-[0_10px_26px_rgba(59,227,143,0.32)] hover:bg-[var(--color-accent-hover)]"
      >
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
