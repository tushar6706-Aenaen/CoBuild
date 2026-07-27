import { z } from "zod";

export const TITLE_MAX = 80;
export const TAGLINE_MAX = 90;
export const DESCRIPTION_MAX = 10_000;
export const MAX_IMAGES = 8;
export const ALT_MAX = 160;
export const CAPTION_MAX = 200;
export const ROLE_LABEL_MAX = 40;

export const PROJECT_STATUSES = ["shipped", "in_progress", "archived"] as const;
export const PROJECT_VISIBILITIES = ["public", "unlisted", "draft"] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export type ProjectVisibility = (typeof PROJECT_VISIBILITIES)[number];

/**
 * Accepts a bare host ("github.com/me/repo") as well as a full URL, but only
 * ever stores an http(s) URL. Rejecting `javascript:`/`data:` matters because
 * these values are rendered as user-clickable links on the detail page.
 */
const httpUrl = z
  .string()
  .trim()
  .transform((value) => (value && !/^https?:\/\//i.test(value) ? `https://${value}` : value))
  .refine((value) => {
    if (!value) return true;
    try {
      const parsed = new URL(value);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  }, "Must be a valid http(s) URL.");

export const projectImageSchema = z.object({
  storagePath: z.string().min(1),
  alt: z.string().trim().max(ALT_MAX),
  caption: z.string().trim().max(CAPTION_MAX).optional().default(""),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
});

export const collaboratorSchema = z.object({
  profileId: z.string().uuid().nullable(),
  invitedName: z.string().trim().max(80).nullable(),
  roleLabel: z.string().trim().max(ROLE_LABEL_MAX),
});

export const projectDraftSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1, "Title is required.").max(TITLE_MAX),
  tagline: z
    .string()
    .trim()
    .max(TAGLINE_MAX, `Taglines must be ${TAGLINE_MAX} characters or fewer.`)
    .optional()
    .default(""),
  description: z.string().max(DESCRIPTION_MAX).optional().default(""),
  liveUrl: httpUrl.optional().default(""),
  repoUrl: httpUrl.optional().default(""),
  status: z.enum(PROJECT_STATUSES),
  visibility: z.enum(PROJECT_VISIBILITIES),
  coverIndex: z.number().int().min(0),
  images: z.array(projectImageSchema).max(MAX_IMAGES),
  tagIds: z.array(z.string().uuid()),
  collaborators: z.array(collaboratorSchema),
});

export type ProjectDraft = z.infer<typeof projectDraftSchema>;

/**
 * Publishing has stricter rules than saving a draft. The "shipped requires a
 * working live URL" rule is deliberate product policy, not an accident: a
 * status badge nobody can verify is worth nothing (see PROJECT_INFO).
 */
export function validateForPublish(draft: ProjectDraft): string | null {
  if (!draft.title.trim()) return "Title is required.";
  if (draft.images.length === 0) return "Add at least one screenshot before publishing.";
  if (draft.images.some((img) => !img.alt.trim())) {
    return "Every image needs alt text before publishing.";
  }
  if (draft.status === "shipped" && !draft.liveUrl.trim()) {
    return "A shipped project needs a live demo URL.";
  }
  return null;
}
