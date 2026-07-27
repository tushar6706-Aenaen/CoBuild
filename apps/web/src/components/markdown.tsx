import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Renders a project's description. Styled to match `CoBuild.dc.html`'s
 * detail-page prose block, but on the token palette rather than the mockup's
 * literal hexes: body copy at `--color-text-secondary`, bold lifted to
 * `--color-text-primary`, blockquotes stepped down to `--color-text-tertiary`,
 * and code blocks in JetBrains Mono on `--color-bg-input` with the
 * `--color-code-highlight` highlight color.
 */
export function Markdown({ content }: { content: string }) {
  return (
    <div className="flex flex-col gap-3.5 text-[14.5px] leading-[1.7] text-[var(--color-text-secondary)] [&_a]:text-[var(--color-accent-muted)] [&_a:hover]:text-[var(--color-link-hover)]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: (p) => <h2 className="mt-1.5 text-[19px] font-bold tracking-tight text-[var(--color-text-primary)]" {...p} />,
          h2: (p) => <h2 className="mt-1.5 text-[19px] font-bold tracking-tight text-[var(--color-text-primary)]" {...p} />,
          h3: (p) => <h3 className="mt-1.5 text-[15.5px] font-bold text-[var(--color-text-primary)]" {...p} />,
          p: (p) => <p className="text-wrap-pretty" {...p} />,
          strong: (p) => <strong className="font-semibold text-[var(--color-text-primary)]" {...p} />,
          ul: (p) => <ul className="flex flex-col gap-1.5 pl-5" style={{ listStyleType: "disc" }} {...p} />,
          ol: (p) => <ol className="flex flex-col gap-1.5 pl-5" style={{ listStyleType: "decimal" }} {...p} />,
          li: (p) => <li {...p} />,
          code: ({ className, ...p }) =>
            className ? (
              <code className={className} {...p} />
            ) : (
              <code className="rounded-[3px] bg-[var(--color-bg-raised)] px-1.5 py-0.5 font-mono text-[13px] text-[var(--color-text-primary)]" {...p} />
            ),
          pre: (p) => (
            <pre
              className="overflow-x-auto rounded-[6px] border border-[var(--color-border-subtle)] bg-[var(--color-bg-input)] p-[15px] font-mono text-[12.5px] leading-relaxed text-[var(--color-code-highlight)]"
              {...p}
            />
          ),
          blockquote: (p) => (
            <blockquote
              className="border-l-2 border-[var(--color-accent)] bg-[var(--color-accent)]/[0.06] py-3 pl-4 text-sm text-[var(--color-text-tertiary)] italic"
              {...p}
            />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
