import type { FeedTab, TopWindow } from "@cobuild/shared";

/**
 * Identity of the feed query, used as `FeedLoadMore`'s `key`.
 *
 * `FeedLoadMore` keeps `items` and `cursor` in `useState`, seeded from props
 * at mount. Every feed filter is a search param on the *same* route, so
 * changing one is a soft navigation: React reconciles the same component at
 * the same position, the `useState` initialisers are ignored, and the client
 * state survives. The result is cards from the previous filter sitting under a
 * freshly filtered first page — and worse, the next "Load more" runs the new
 * filter's query from the *old* filter's keyset cursor.
 *
 * Keying on the query identity forces a remount instead, which is what
 * re-seeds both pieces of state. Every input that changes which rows
 * `feed_page` returns must appear here — miss one and that axis silently
 * reintroduces the bug. `looking_for` is sorted so chip order can't produce
 * two keys for the same filter.
 */
export function feedResetKey(input: {
  tab: FeedTab;
  window: TopWindow;
  tag?: string | null;
  lookingFor?: readonly string[];
}): string {
  const lookingFor = [...(input.lookingFor ?? [])].sort().join(",");
  return [input.tab, input.window, input.tag ?? "", lookingFor].join("|");
}
