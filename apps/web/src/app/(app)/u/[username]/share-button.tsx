"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ShareButton() {
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard API can be denied by browser permissions — fail silently,
      // the URL bar is always a fallback.
    }
  }

  return (
    <Button
      type="button"
      onClick={handleClick}
      variant="outline"
      className="rounded-[var(--radius-control)] border-[var(--color-border-strong)] bg-[var(--color-bg-panel-alt)] px-5 py-2.5 text-[13px] font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-bg-raised)]"
    >
      {copied ? "Link copied" : "Share profile"}
    </Button>
  );
}
