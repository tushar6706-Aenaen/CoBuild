import { ImageResponse } from "next/og";
import { getProjectDetail, transformedStorageUrl } from "@cobuild/shared";
import { storageUrl } from "@/lib/storage-url";
import {
  AccentStrip,
  Avatar,
  CommentIcon,
  FallbackCard,
  Stat,
  UpvoteIcon,
  Wordmark,
} from "@/lib/og/card";
import { createOgClient } from "@/lib/og/client";
import { ogFonts } from "@/lib/og/fonts";
import { fetchOgImage } from "@/lib/og/remote-image";
import { OG, STATUS_LABEL, clamp, compactCount, fitContain } from "@/lib/og/theme";

/**
 * The cover panel's inner box: 500px panel − 40px padding either side = 420
 * wide, and 500 tall clears the 622px of card below the accent strip.
 */
const COVER_BOX = { width: 420, height: 500 };

export const alt = "A project on CoBuild";
export const size = OG.size;
export const contentType = "image/png";

/**
 * Cards are crawled far more often than they change — every reshare of a link
 * re-requests this — and nothing on them is viewer-specific (see
 * `createOgClient`). An hour of staleness on an upvote count is a fair trade
 * for not rendering a fresh PNG per crawl.
 */
export const revalidate = 3600;

export default async function ProjectOgImage({
  params,
}: {
  params: Promise<{ username: string; slug: string }>;
}) {
  const { username, slug } = await params;
  const supabase = createOgClient();
  const fonts = await ogFonts();

  const project = await getProjectDetail(supabase, username, slug);

  // Anonymous RLS has already excluded drafts and anything deleted; what's left
  // is a link to something that no longer resolves.
  if (!project) {
    return new ImageResponse(<FallbackCard />, { ...size, fonts });
  }

  // The cover is always one of the project's own images (see `projects.ts` —
  // it's `draft.images[coverIndex]`), so its true pixel dimensions are already
  // in hand. That matters: the transform endpoint only bounds one axis, so the
  // fitted box has to be computed here rather than delegated to it.
  const coverImage = project.cover_image_path
    ? project.images.find((img) => img.storage_path === project.cover_image_path)
    : undefined;
  const coverFit =
    coverImage?.width && coverImage?.height
      ? fitContain(coverImage.width, coverImage.height, COVER_BOX)
      : null;

  const [cover, avatar] = await Promise.all([
    fetchOgImage(
      project.cover_image_path
        ? transformedStorageUrl(
            storageUrl(project.cover_image_path, "project-media")!,
            coverFit
              ? // 2× the display size: the card is downscaled by every social
                // client, and a 1× fetch reads soft next to the crisp text.
                {
                  width: coverFit.width * 2,
                  height: coverFit.height * 2,
                  fit: "contain",
                }
              : // Dimensions unknown (a pre-existing row with null width/height):
                // a fixed-box crop is the only option that cannot overflow.
                {
                  width: COVER_BOX.width * 2,
                  height: COVER_BOX.height * 2,
                  fit: "cover",
                },
          )
        : null,
    ),
    fetchOgImage(
      project.author.avatar_url
        ? transformedStorageUrl(storageUrl(project.author.avatar_url, "avatars")!, {
            width: 96,
            height: 96,
            fit: "cover",
          })
        : null,
    ),
  ]);

  const status = STATUS_LABEL[project.status] ?? STATUS_LABEL.in_progress;
  const authorName = project.author.display_name ?? project.author.username ?? "Someone";
  const tags = project.tags.slice(0, 4);

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          backgroundColor: OG.bg,
          color: OG.text,
          fontFamily: OG.sans,
        }}
      >
        <AccentStrip />

        <div style={{ display: "flex", flex: 1 }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              justifyContent: "space-between",
              padding: "44px 48px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <Wordmark />
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "7px 14px",
                  borderRadius: 999,
                  // satori has no color-mix(): these are the pre-composed
                  // equivalents of the app's `color-mix(… 12%)` / `… 30%` chips.
                  backgroundColor: `${status.color}1F`,
                  border: `1px solid ${status.color}4D`,
                  color: status.color,
                  fontSize: 17,
                  fontWeight: 700,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    backgroundColor: status.color,
                  }}
                />
                {status.label}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div
                style={{
                  display: "flex",
                  fontFamily: OG.mono,
                  // With no cover panel the column is ~500px wider, so the
                  // type scale and the character budgets both open up.
                  fontSize: cover ? 46 : 58,
                  fontWeight: 500,
                  letterSpacing: -1.4,
                  lineHeight: 1.12,
                }}
              >
                {clamp(project.title, cover ? 52 : 68)}
              </div>
              {project.tagline && (
                <div
                  style={{
                    display: "flex",
                    fontSize: cover ? 24 : 28,
                    lineHeight: 1.35,
                    color: OG.textSecondary,
                  }}
                >
                  {clamp(project.tagline, cover ? 104 : 140)}
                </div>
              )}
              {tags.length > 0 && (
                <div style={{ display: "flex", gap: 9 }}>
                  {tags.map((tag) => (
                    <div
                      key={tag.slug}
                      style={{
                        display: "flex",
                        padding: "6px 12px",
                        borderRadius: 6,
                        backgroundColor: OG.raised,
                        color: OG.accentMuted,
                        fontFamily: OG.mono,
                        fontSize: 17,
                        fontWeight: 500,
                      }}
                    >
                      {clamp(tag.name, 18)}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <Avatar src={avatar} fallback={authorName} size={58} />
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <div style={{ display: "flex", fontSize: 23, fontWeight: 700 }}>
                  {clamp(authorName, 26)}
                </div>
                <div
                  style={{
                    display: "flex",
                    fontFamily: OG.mono,
                    fontSize: 19,
                    color: OG.accentMuted,
                  }}
                >
                  @{project.author.username}
                </div>
              </div>

              <div style={{ display: "flex", flex: 1 }} />

              <Stat
                value={compactCount(project.upvote_count)}
                icon={<UpvoteIcon color={OG.accent} />}
                color={OG.accent}
              />
              <Stat
                value={compactCount(project.comment_count)}
                icon={<CommentIcon color={OG.textTertiary} />}
                color={OG.textSecondary}
              />
            </div>
          </div>

          {cover && (
            <div
              style={{
                display: "flex",
                width: 500,
                alignItems: "center",
                justifyContent: "center",
                padding: 40,
                borderLeft: `1px solid ${OG.border}`,
                backgroundImage: `linear-gradient(160deg, ${OG.panelAlt} 0%, ${OG.bg} 100%)`,
              }}
            >
              {/* Explicit width/height, always. Letting satori take the
                  intrinsic size instead trusts the transform to have bounded
                  both axes, which it does not — that overflowed the card with
                  a portrait cover. */}
              <img
                src={cover}
                alt=""
                width={coverFit?.width ?? COVER_BOX.width}
                height={coverFit?.height ?? COVER_BOX.height}
                style={{ borderRadius: 10, border: `1px solid ${OG.border}` }}
              />
            </div>
          )}
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
