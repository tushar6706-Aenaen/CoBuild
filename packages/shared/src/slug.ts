/** URL-safe slug from a project title. Mirrors the seed script's slugify. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

/**
 * `projects` has a UNIQUE (author_id, slug) constraint, so a second project
 * with the same title needs a suffix. Callers pass the slugs already taken by
 * that author; `excludeSlug` lets an edit keep its own slug.
 */
export function uniqueSlug(base: string, taken: string[], excludeSlug?: string): string {
  const root = slugify(base) || "project";
  const takenSet = new Set(taken.filter((s) => s !== excludeSlug));
  if (!takenSet.has(root)) return root;
  for (let n = 2; n < 1000; n++) {
    const candidate = `${root}-${n}`;
    if (!takenSet.has(candidate)) return candidate;
  }
  return `${root}-${Date.now()}`;
}
