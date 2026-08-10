import { ImageResponse } from "next/og";
import { getProfileByUsername, transformedStorageUrl } from "@cobuild/shared";
import { storageUrl } from "@/lib/storage-url";
import { AccentStrip, Avatar, FallbackCard, Wordmark } from "@/lib/og/card";
import { createOgClient } from "@/lib/og/client";
import { ogFonts } from "@/lib/og/fonts";
import { fetchOgImage } from "@/lib/og/remote-image";
import { OG, clamp, compactCount } from "@/lib/og/theme";

export const alt = "A builder on CoBuild";
export const size = OG.size;
export const contentType = "image/png";

/** Same reasoning as the project card — see its `revalidate`. */
export const revalidate = 3600;

export default async function ProfileOgImage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const supabase = createOgClient();
  const fonts = await ogFonts();

  const profile = await getProfileByUsername(supabase, username);
  if (!profile) {
    return new ImageResponse(<FallbackCard />, { ...size, fonts });
  }

  const avatar = await fetchOgImage(
    profile.avatar_url
      ? transformedStorageUrl(storageUrl(profile.avatar_url, "avatars")!, {
          width: 320,
          height: 320,
          fit: "cover",
        })
      : null,
  );

  const name = profile.display_name ?? profile.username ?? "Builder";
  const subtitle = profile.headline ?? profile.bio;
  // `roles` carries "student" as a member, but the student badge below renders
  // it with the college/grad-year detail — showing both would say it twice.
  const roles = profile.roles.filter((r) => r !== "student").slice(0, 3);

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

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            justifyContent: "space-between",
            padding: "44px 56px",
          }}
        >
          <Wordmark />

          <div style={{ display: "flex", alignItems: "center", gap: 34 }}>
            <Avatar src={avatar} fallback={name} size={158} />

            <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
              <div
                style={{
                  display: "flex",
                  fontSize: 52,
                  fontWeight: 700,
                  letterSpacing: -1.4,
                  lineHeight: 1.1,
                }}
              >
                {clamp(name, 30)}
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: 26,
                  color: OG.accentMuted,
                }}
              >
                @{profile.username}
              </div>
              {subtitle && (
                <div
                  style={{
                    display: "flex",
                    fontSize: 23,
                    lineHeight: 1.35,
                    color: OG.textSecondary,
                  }}
                >
                  {clamp(subtitle, 96)}
                </div>
              )}

              {(roles.length > 0 || profile.is_student) && (
                <div style={{ display: "flex", gap: 9, marginTop: 4 }}>
                  {roles.map((role) => (
                    <div
                      key={role}
                      style={{
                        display: "flex",
                        padding: "7px 14px",
                        borderRadius: 6,
                        border: `1px solid ${OG.accent}38`,
                        backgroundColor: `${OG.accent}1F`,
                        color: OG.accentMuted,
                        fontSize: 18,
                        fontWeight: 700,
                      }}
                    >
                      {role.charAt(0).toUpperCase() + role.slice(1)}
                    </div>
                  ))}
                  {profile.is_student && (
                    <div
                      style={{
                        display: "flex",
                        padding: "7px 14px",
                        borderRadius: 6,
                        border: `1px solid ${OG.border}`,
                        backgroundColor: OG.panelAlt,
                        color: OG.textSecondary,
                        fontSize: 18,
                        fontWeight: 700,
                      }}
                    >
                      {clamp(
                        profile.college
                          ? `Student · ${profile.college}`
                          : "Student",
                        34,
                      )}
                      {profile.grad_year ? ` '${String(profile.grad_year).slice(-2)}` : ""}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: 14,
              borderTop: `1px solid ${OG.borderSubtle}`,
              paddingTop: 26,
            }}
          >
            <StatBlock value={compactCount(profile.project_count)} label="Projects" />
            <StatBlock
              value={compactCount(profile.total_upvotes_received)}
              label="Upvotes"
              accent
            />
            <StatBlock value={compactCount(profile.follower_count)} label="Followers" />
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}

function StatBlock({
  value,
  label,
  accent = false,
}: {
  value: string;
  label: string;
  accent?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        flex: 1,
        padding: "18px 24px",
        borderRadius: 10,
        border: `1px solid ${OG.border}`,
        backgroundColor: OG.panel,
      }}
    >
      <div
        style={{
          display: "flex",
          fontSize: 38,
          fontWeight: 500,
          color: accent ? OG.accent : OG.text,
        }}
      >
        {value}
      </div>
      <div style={{ display: "flex", fontSize: 19, color: OG.textTertiary }}>{label}</div>
    </div>
  );
}
