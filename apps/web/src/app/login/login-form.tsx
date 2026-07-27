"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { AUTH_CALLBACK_PATH, DEFAULT_SIGNED_IN_PATH } from "@/lib/auth/redirects";
import { AUTH_ERROR_MESSAGES, isAuthErrorCode } from "./error-messages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

/** Builds the absolute `/auth/callback` URL, forwarding a same-origin `next` if present. */
function callbackUrl(next: string | null) {
  const url = new URL(AUTH_CALLBACK_PATH, window.location.origin);
  if (next && next !== DEFAULT_SIGNED_IN_PATH) url.searchParams.set("next", next);
  return url.toString();
}

function GitHubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2a10 10 0 00-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.1-1.47-1.1-1.47-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.5 9.5 0 015 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0012 2z" />
    </svg>
  );
}

function GoogleDot() {
  return (
    <span
      className="block h-[18px] w-[18px] rounded-full"
      style={{
        background:
          "conic-gradient(#EA4335 0 25%, #FBBC05 25% 50%, #34A853 50% 75%, #4285F4 75%)",
      }}
    />
  );
}

export function LoginForm() {
  const searchParams = useSearchParams();
  const errorParam = searchParams.get("error");
  const next = searchParams.get("next");

  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [oauthPending, setOauthPending] = useState<"github" | "google" | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const bannerMessage = isAuthErrorCode(errorParam) ? AUTH_ERROR_MESSAGES[errorParam] : null;

  async function handleOAuth(provider: "github" | "google") {
    setOauthPending(provider);
    setFormError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: callbackUrl(next) },
    });
    if (error) {
      setFormError(error.message);
      setOauthPending(null);
    }
    // On success the browser navigates away to the provider — nothing else to do here.
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("sending");
    setFormError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: callbackUrl(next) },
    });
    if (error) {
      setFormError(error.message);
      setStatus("error");
      return;
    }
    setStatus("sent");
  }

  return (
    <div className="flex w-full max-w-[412px] flex-col gap-6 text-center">
      <div className="flex flex-col items-center gap-3.5">
        <div className="flex h-[46px] w-[46px] items-center justify-center rounded-[var(--radius-control-lg)] bg-[var(--color-accent)] text-[20px] font-extrabold text-[var(--color-accent-on)] shadow-[0_10px_30px_rgba(59,227,143,0.4)]">
          C
        </div>
        <h1 className="text-[27px] font-extrabold tracking-tight">Sign in to CoBuild</h1>
        <p className="max-w-[320px] text-sm leading-relaxed text-[var(--color-text-secondary)]">
          Post what you&rsquo;ve built, upvote what you like, and keep a portfolio you can put on
          a résumé.
        </p>
      </div>

      {bannerMessage && (
        <div className="rounded-[var(--radius-control)] border border-[var(--color-status-danger)]/30 bg-[var(--color-status-danger)]/10 px-4 py-3 text-sm text-[var(--color-status-danger-strong)]">
          {bannerMessage}
        </div>
      )}

      <div className="flex flex-col gap-2.5 rounded-[var(--radius-card)] border border-[var(--color-border-default)] bg-[var(--color-bg-panel-alt)] p-[22px] text-left">
        <Button
          type="button"
          onClick={() => handleOAuth("github")}
          disabled={oauthPending !== null}
          className="flex h-auto items-center justify-center gap-2.5 rounded-[var(--radius-control)] bg-[var(--color-text-primary)] py-3.5 text-[14.5px] font-bold text-[var(--color-bg-page)] hover:bg-white"
        >
          <GitHubIcon />
          {oauthPending === "github" ? "Redirecting…" : "Continue with GitHub"}
        </Button>
        <Button
          type="button"
          onClick={() => handleOAuth("google")}
          disabled={oauthPending !== null}
          variant="outline"
          className="flex h-auto items-center justify-center gap-2.5 rounded-[var(--radius-control)] border-[var(--color-border-strong)] bg-[var(--color-bg-raised)] py-3.5 text-[14.5px] font-bold text-[var(--color-text-primary)] hover:bg-[var(--color-bg-panel)]"
        >
          <GoogleDot />
          {oauthPending === "google" ? "Redirecting…" : "Continue with Google"}
        </Button>

        <div className="my-1.5 flex items-center gap-3">
          <Separator className="flex-1 bg-[var(--color-border-default)]" />
          <span className="font-mono text-[11.5px] text-[var(--color-text-tertiary)]">OR</span>
          <Separator className="flex-1 bg-[var(--color-border-default)]" />
        </div>

        {status === "sent" ? (
          <div className="flex flex-col gap-1.5 py-1">
            <span className="text-[13.5px] font-semibold text-[var(--color-accent-muted)]">
              Check your email
            </span>
            <span className="text-[12.5px] text-[var(--color-text-secondary)]">
              We sent a sign-in link to {email.trim()}.
            </span>
          </div>
        ) : (
          <form onSubmit={handleMagicLink} className="flex flex-col gap-2">
            <Label htmlFor="email" className="text-[12.5px] font-semibold text-[var(--color-text-secondary-alt)]">
              Email magic link
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@school.edu"
              required
              className="rounded-[var(--radius-control)] border-[var(--color-border-default)] bg-[var(--color-bg-input)] py-3 text-sm text-[var(--color-text-primary)]"
            />
            <Button
              type="submit"
              disabled={status === "sending"}
              className="rounded-[var(--radius-control)] bg-[var(--color-accent)] py-3.5 text-[14.5px] font-bold text-[var(--color-accent-on)] shadow-[0_8px_22px_rgba(59,227,143,0.3)] hover:bg-[var(--color-accent-hover)]"
            >
              {status === "sending" ? "Sending…" : "Send me a link"}
            </Button>
          </form>
        )}

        {formError && (
          <p className="text-[12.5px] text-[var(--color-status-danger-strong)]">{formError}</p>
        )}
      </div>

      <div className="text-xs leading-relaxed text-[var(--color-text-tertiary)]">
        By continuing you agree to the Terms and Privacy Policy.
        <br />
        <Link href="/" className="text-[var(--color-accent-muted)]">
          Keep browsing without an account
        </Link>
      </div>
    </div>
  );
}
