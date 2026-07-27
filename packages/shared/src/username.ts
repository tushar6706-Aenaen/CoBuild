import { z } from "zod";

/**
 * Client-side mirror of the database constraints on `public.profiles.username`.
 *
 * Source of truth (migration `20260726080304_create_profiles_table`):
 *   - column type `extensions.citext` with a UNIQUE index  -> comparison is
 *     case-insensitive, so `Foo` and `foo` collide.
 *   - `profiles_username_format`   CHECK  `^[a-zA-Z0-9_-]{2,39}$`
 *   - `profiles_username_not_reserved` CHECK `lower(username) NOT IN (...)`
 *
 * Keep this file in sync with that migration — it exists so the UI can reject
 * bad input before a round trip, not as a replacement for the DB constraints.
 */

/** Exactly the regex used by the `profiles_username_format` CHECK constraint. */
export const USERNAME_REGEX = /^[a-zA-Z0-9_-]{2,39}$/;

export const USERNAME_MIN_LENGTH = 2;
export const USERNAME_MAX_LENGTH = 39;

/**
 * Exactly the list in the `profiles_username_not_reserved` CHECK constraint.
 * Compared case-insensitively by the database (`lower(username) not in (...)`).
 */
export const RESERVED_USERNAMES = [
  "new",
  "settings",
  "api",
  "admin",
  "login",
  "u",
  "p",
  "tag",
  "leaderboard",
  "search",
  "notifications",
  "bookmarks",
  "auth",
  "static",
  "assets",
] as const;

const RESERVED_SET = new Set<string>(RESERVED_USERNAMES);

export function isReservedUsername(candidate: string): boolean {
  return RESERVED_SET.has(candidate.trim().toLowerCase());
}

/**
 * Validates a candidate username against every rule the database enforces.
 * Does **not** check uniqueness — that needs a query (see `usernameIsTaken`).
 */
export const usernameSchema = z
  .string()
  .trim()
  .min(USERNAME_MIN_LENGTH, `Must be at least ${USERNAME_MIN_LENGTH} characters.`)
  .max(USERNAME_MAX_LENGTH, `Must be at most ${USERNAME_MAX_LENGTH} characters.`)
  .regex(USERNAME_REGEX, "Only letters, numbers, hyphens and underscores.")
  .refine((value) => !isReservedUsername(value), "That username is reserved.");

export type UsernameCheckResult =
  | { ok: true; username: string }
  | { ok: false; reason: string };

/** Convenience wrapper returning the first error message instead of a ZodError. */
export function validateUsername(input: string): UsernameCheckResult {
  const parsed = usernameSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, reason: parsed.error.issues[0]?.message ?? "Invalid username." };
  }
  return { ok: true, username: parsed.data };
}
