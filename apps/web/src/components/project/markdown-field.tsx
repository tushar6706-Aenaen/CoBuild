"use client";

import { useRef, useState } from "react";
import { Markdown } from "@/components/markdown";
import { Textarea } from "@/components/ui/textarea";

type ToolAction = { label: string; apply: (selected: string) => { text: string; cursorOffset: number } };

/** Headings, list items, and fenced code are only valid markdown at the start of a line. */
const BLOCK_PREFIXES = ["## ", "- ", "```"];

const TOOLS: ToolAction[] = [
  { label: "B", apply: (s) => ({ text: `**${s || "bold text"}**`, cursorOffset: 2 }) },
  { label: "i", apply: (s) => ({ text: `*${s || "italic text"}*`, cursorOffset: 1 }) },
  { label: "H2", apply: (s) => ({ text: `## ${s || "Heading"}`, cursorOffset: 3 }) },
  { label: "link", apply: (s) => ({ text: `[${s || "text"}](https://)`, cursorOffset: 1 }) },
  {
    label: "code",
    apply: (s) =>
      s.includes("\n")
        ? { text: `\`\`\`\n${s}\n\`\`\``, cursorOffset: 4 }
        : { text: `\`${s || "code"}\``, cursorOffset: 1 },
  },
  { label: "list", apply: (s) => ({ text: `- ${s || "item"}`, cursorOffset: 2 }) },
];

/**
 * The composer's description field, translated from `CoBuild.dc.html`'s
 * `mdTabs`/`mdTools` — a Write/Preview toggle plus a toolbar that inserts
 * markdown syntax at the cursor, rendered live through the same `<Markdown>`
 * component the detail page uses, so what you preview is what ships.
 */
export function MarkdownField({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const [mode, setMode] = useState<"write" | "preview">("write");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // `cursorOffset` is where the caret lands when nothing was selected (e.g.
  // right after "**" so typing continues inside the bold marks). When text
  // *was* selected, the whole inserted block now wraps it, so the caret
  // goes to the end of the insertion instead.
  function applyTool(tool: ToolAction) {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.slice(start, end);
    let { text, cursorOffset } = tool.apply(selected);

    // Headings/lists/fenced code must start a line, or they're just literal
    // text to the markdown renderer. Prepend a newline unless the cursor is
    // already at the very start of the field or the start of a line.
    const isBlock = BLOCK_PREFIXES.some((p) => text.startsWith(p));
    const atLineStart = start === 0 || value[start - 1] === "\n";
    if (isBlock && !atLineStart) {
      text = `\n${text}`;
      cursorOffset += 1;
    }

    onChange(value.slice(0, start) + text + value.slice(end));

    const caret = start + (selected ? text.length : cursorOffset);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(caret, caret);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2.5">
        <label htmlFor={id} className="text-[12.5px] font-semibold text-[var(--color-text-secondary-alt)]">
          Description
        </label>
        <div className="flex gap-1 rounded-[5px] border border-[var(--color-border-default)] bg-[var(--color-bg-input)] p-[3px]">
          {(["write", "preview"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={
                mode === m
                  ? "rounded-[4px] bg-[var(--color-accent)] px-2.5 py-1 text-[11.5px] font-semibold text-[var(--color-accent-on)]"
                  : "rounded-[4px] px-2.5 py-1 text-[11.5px] font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              }
            >
              {m === "write" ? "Write" : "Preview"}
            </button>
          ))}
        </div>
      </div>

      {mode === "write" ? (
        <>
          <div className="flex gap-0.5 rounded-t-[6px] border border-b-0 border-[var(--color-border-default)] bg-[var(--color-bg-panel-alt)] p-1.5">
            {TOOLS.map((tool) => (
              <button
                key={tool.label}
                type="button"
                onClick={() => applyTool(tool)}
                className="flex h-7 min-w-[30px] items-center justify-center rounded-[4px] px-2 font-mono text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-raised)] hover:text-[var(--color-text-primary)]"
              >
                {tool.label}
              </button>
            ))}
          </div>
          <Textarea
            id={id}
            ref={textareaRef}
            rows={7}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="What problem does it solve? What was hard about building it?"
            className="resize-y rounded-t-none rounded-b-[6px] border-[var(--color-border-default)] bg-[var(--color-bg-input)] font-mono text-[13px] leading-[1.65]"
          />
        </>
      ) : (
        <div className="min-h-[176px] rounded-[6px] border border-[var(--color-border-default)] bg-[var(--color-bg-input)] p-[13px_14px]">
          {value.trim() ? (
            <Markdown content={value} />
          ) : (
            <span className="text-sm text-[var(--color-text-placeholder)]">Nothing to preview yet.</span>
          )}
        </div>
      )}
    </div>
  );
}
