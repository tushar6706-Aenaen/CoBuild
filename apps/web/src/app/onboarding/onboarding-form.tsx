"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { validateUsername, usernameIsTaken } from "@cobuild/shared";
import { completeOnboarding, type OnboardingState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

type InitialProfile = {
  username: string | null;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  roles: string[];
  isStudent: boolean;
  college: string | null;
  gradYear: number | null;
};

const ROLE_CHIPS = [
  { value: "developer", label: "Developer" },
  { value: "designer", label: "Designer" },
  { value: "founder", label: "Founder" },
  { value: "other", label: "Other" },
] as const;

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

type UsernameStatus = "idle" | "checking" | "ok" | "bad" | "taken";

function extensionFor(file: File): string {
  if (file.type === "image/png") return "png";
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

export function OnboardingForm({
  userId,
  next,
  initial,
}: {
  userId: string;
  next: string;
  initial: InitialProfile;
}) {
  const initialState: OnboardingState = {};
  const [state, formAction, pending] = useActionState(completeOnboarding, initialState);
  const [supabase] = useState(() => createClient());

  const [username, setUsername] = useState(initial.username ?? "");
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("idle");
  const [usernameMessage, setUsernameMessage] = useState<string>("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [avatarPath, setAvatarPath] = useState(initial.avatarUrl ?? "");
  // `avatar_url` is a storage PATH, not a resolvable URL (see PROJECT_INFO.md
  // gotchas) — resolve it through the SDK rather than using it as an <img src>
  // directly. getPublicUrl is pure string-building, no network call.
  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    initial.avatarUrl ? supabase.storage.from("avatars").getPublicUrl(initial.avatarUrl).data.publicUrl : null,
  );
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const [roles, setRoles] = useState<Set<string>>(new Set(initial.roles.filter((r) => r !== "student")));
  const [isStudent, setIsStudent] = useState(initial.isStudent);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const candidate = username.trim();
    if (!candidate) {
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
        const supabase = createClient();
        const taken = await usernameIsTaken(supabase, format.username);
        // Only trust the response if the field hasn't changed since we asked.
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
        setUsernameStatus("idle");
      }
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]);

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

  const canSubmit =
    (usernameStatus === "ok" || (usernameStatus === "idle" && initial.username === username.trim())) &&
    !avatarUploading &&
    !pending;

  return (
    <form action={formAction} className="flex w-full max-w-[520px] flex-col gap-5">
      <div className="flex flex-col gap-2">
        <span className="font-mono text-[11.5px] tracking-[0.12em] text-[var(--color-accent)]">
          STEP 1 OF 1 · WELCOME
        </span>
        <h1 className="text-[27px] font-extrabold tracking-tight">Claim your handle</h1>
        <p className="text-sm text-[var(--color-text-secondary)]">
          This becomes your portfolio URL. You can change it once.
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
                {avatarUploading ? "Uploading…" : "Upload image"}
                <input
                  id="avatar-input"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
              </label>
            </Button>
            <span className="text-[11.5px] text-[var(--color-text-tertiary)]">
              PNG or JPG, square, up to 2 MB
            </span>
            {avatarError && (
              <span className="text-[11.5px] text-[var(--color-status-danger)]">{avatarError}</span>
            )}
          </div>
        </div>
        <input type="hidden" name="avatarPath" value={avatarPath} />

        <div className="flex flex-col gap-2">
          <Label htmlFor="displayName" className="text-[12.5px] font-semibold text-[var(--color-text-secondary-alt)]">
            Display name
          </Label>
          <Input
            id="displayName"
            name="displayName"
            defaultValue={initial.displayName ?? ""}
            className="rounded-[var(--radius-control)] border-[var(--color-border-default)] bg-[var(--color-bg-input)] py-3 text-sm"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="bio" className="text-[12.5px] font-semibold text-[var(--color-text-secondary-alt)]">
            Short bio <span className="font-normal text-[var(--color-text-placeholder)]">· optional</span>
          </Label>
          <Textarea
            id="bio"
            name="bio"
            rows={3}
            defaultValue={initial.bio ?? ""}
            placeholder="What are you building right now?"
            className="resize-y rounded-[var(--radius-control)] border-[var(--color-border-default)] bg-[var(--color-bg-input)] text-sm"
          />
        </div>

        <div className="flex flex-col gap-2.5">
          <Label className="text-[12.5px] font-semibold text-[var(--color-text-secondary-alt)]">
            I am a… <span className="font-normal text-[var(--color-text-placeholder)]">· pick one or more</span>
          </Label>
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
              <span className="text-xs text-[var(--color-text-tertiary)]">
                Shows a student badge on your profile
              </span>
            </div>
            <Switch
              name="isStudent"
              checked={isStudent}
              onCheckedChange={setIsStudent}
              className="data-[state=checked]:bg-[var(--color-accent)]"
            />
          </div>
          {isStudent && (
            <div className="grid grid-cols-[1fr_130px] gap-2.5">
              <Input
                name="college"
                placeholder="College"
                defaultValue={initial.college ?? ""}
                className="rounded-[var(--radius-control)] border-[var(--color-border-default)] bg-[var(--color-bg-input)] py-3 text-sm"
              />
              <Input
                name="gradYear"
                placeholder="Year"
                type="number"
                defaultValue={initial.gradYear ?? undefined}
                className="rounded-[var(--radius-control)] border-[var(--color-border-default)] bg-[var(--color-bg-input)] py-3 text-sm font-mono"
              />
            </div>
          )}
        </div>
      </div>

      <input type="hidden" name="next" value={next} />

      {state.error && (
        <p className="text-[13px] text-[var(--color-status-danger-strong)]">{state.error}</p>
      )}

      <Button
        type="submit"
        disabled={!canSubmit}
        className="rounded-[var(--radius-control-lg)] bg-[var(--color-accent)] py-3.5 text-[15px] font-bold text-[var(--color-accent-on)] shadow-[0_10px_26px_rgba(59,227,143,0.32)] hover:bg-[var(--color-accent-hover)]"
      >
        {pending ? "Creating…" : "Create my profile"}
      </Button>
    </form>
  );
}
