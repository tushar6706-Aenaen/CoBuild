"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * The search box. Results are server-rendered from `?q=`, so this field's only
 * job is to keep the URL in step with what has been typed — which also makes
 * every result page shareable and back-button-correct.
 *
 * Debounced and `replace`d rather than `push`ed: a keystroke is not a
 * navigation event, and pushing one history entry per character would make
 * Back require as many presses as the query has letters.
 */
export function SearchField({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [value, setValue] = useState(initialQuery);
  const inputRef = useRef<HTMLInputElement>(null);

  // Re-sync when the URL changes underneath us (Back/Forward, or a filter
  // chip navigating). Without this the field keeps whatever was last typed
  // and silently disagrees with the results below it.
  useEffect(() => {
    setValue(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    if (value === initialQuery) return;
    const id = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (value.trim()) next.set("q", value.trim());
      else next.delete("q");
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, 250);
    return () => clearTimeout(id);
  }, [value, initialQuery, params, pathname, router]);

  return (
    <div className="flex items-center gap-2.5 rounded-[8px] border border-[var(--color-accent)]/35 bg-[var(--color-bg-panel)] px-4 py-3.5">
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--color-text-tertiary)"
        strokeWidth={2}
        strokeLinecap="round"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-4-4" />
      </svg>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoFocus
        type="search"
        aria-label="Search projects, people, and tags"
        placeholder="Search projects, people, tags…"
        className="flex-1 border-none bg-transparent p-0 text-base text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-placeholder)] [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            setValue("");
            inputRef.current?.focus();
          }}
          className="px-1 text-lg leading-none text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
        >
          ×
        </button>
      )}
    </div>
  );
}
