/**
 * Remaining-characters hint for a capped text field.
 *
 * Stays hidden until you're within `showWithin` of the cap, so a form of six
 * fields isn't six permanent counters — the number appears exactly when it
 * starts to matter, and turns red at zero to explain why typing just stopped.
 * Paired with `maxLength`, which is what actually prevents the loss.
 */
export function FieldCounter({
  value,
  max,
  showWithin = 20,
}: {
  value: string;
  max: number;
  showWithin?: number;
}) {
  const remaining = max - value.length;
  if (remaining > showWithin) return null;

  return (
    <span
      className={`self-end font-mono text-[11px] tabular-nums ${
        remaining === 0
          ? "text-[var(--color-status-danger)]"
          : "text-[var(--color-text-secondary)]"
      }`}
    >
      {remaining} left
    </span>
  );
}
