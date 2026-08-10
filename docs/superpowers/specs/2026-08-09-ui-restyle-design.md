# CoBuild UI restyle — design

**Date:** 2026-08-09
**Status:** approved, pending implementation plan
**Reference:** `https://ideonbuilds.vercel.app/` (values extracted live, normalised for its 110% page zoom)

---

## Goal

Make CoBuild's dark UI read as premium by adopting the restraint of the reference
site — monochrome chrome, hairline separation, larger radii, no glows — without
changing what any page *is*.

## Non-goals

- **No layout or structural change.** The sidebar stays. Page composition,
  component hierarchy and route structure are untouched. The reference's shell
  already matches CoBuild's (left rail, centre feed with pill tabs, right
  sidebar), so there is nothing to gain structurally.
- **No new features, no copy changes, no a11y refactor** beyond keeping the
  contrast guarantees that already exist.
- **Not a light theme.** CoBuild stays dark-only, as documented.

---

## The finding that drives everything

The reference does not look premium because its colours are nicer. It looks
premium because it is **restrained**:

1. Its chrome is monochrome. `--primary` is `#e5e5e5`, near-white — emphasis
   comes from *lightness*, not saturation. There is no brand hue in the chrome.
2. Depth comes from 1px hairlines (`#ffffff1a`) and translucent tints
   (`#19191b` at 40% over `#0a0a0a`), never from shadows. Every element on the
   page wider than 150px carries `box-shadow: none`.
3. Radii are larger: `--radius: 10px`, scaling to 14 and 18, plus full pills.
4. Micro-labels are 10px, weight 400, **3px letter-spacing**, uppercase.

CoBuild currently runs the opposite playbook: a saturated `#3BE38F` across 189
references and 8 accent-glow shadows, radii clustered tight at 3–11px, and
monospace used as page texture.

**Decision: green becomes an event, not a texture.**

---

## 1. Palette

### 1.1 Surfaces go true neutral

CoBuild's greys are subtly green-tinted (`#090A09` is R9 G10 B9; the tint grows
to +3 at `bg.raised`). A mostly-monochrome scheme built on tinted greys reads
muddy — the tint competes with the one saturated element we are keeping. Going
neutral is what makes the green CTA land.

| token | current | new |
|---|---|---|
| `bg.page` | `#090A09` | `#0A0A0A` |
| `bg.sidebar` | `#0C0E0C` | `#0C0C0C` |
| `bg.panel` | `#0F110F` | `#0F0F0F` |
| `bg.input` | `#111311` | `#111111` |
| `bg.panelAlt` | `#121412` | `#121212` |
| `bg.raised` | `#181B18` | `#1A1A1A` |

`bgRgb.page` → `10 10 10` and `bgRgb.panel` → `15 15 15` must move with them;
they are hand-maintained channel copies used by the image scrims.

### 1.2 Text tiers, re-measured

Neutralising makes `bg.raised` slightly lighter, so it stays the binding surface
and **every tier had to be re-measured**. Ratios below are the minimum across all
six surfaces (`page`, `sidebar`, `panel`, `input`, `panelAlt`, `raised`).

| token | current | new | min ratio |
|---|---|---|---|
| `text.primary` | `#E8EDE8` | `#EDEDED` | 14.87 ✅ |
| `text.secondary` | `#8B8F8B` | `#8C8C8C` | 5.18 ✅ |
| `text.secondaryAlt` | `#949994` | `#949494` | 5.74 ✅ |
| `text.tertiary` | `#7F847F` | `#828282` | 4.53 ✅ |
| `text.placeholder` | `#5A605A` | `#5A5A5A` | 2.69 — pseudo-element only |

`#808080` was the intuitive choice for tertiary and **fails at 4.41:1** on
`raised`. This is the second time an eyeballed grey has failed AA on this
palette; measure, never assume. `status.archived` moves with `text.tertiary` to
`#828282`, for the reason recorded in `colors.ts`: it renders as the chip's small
label text, not just its dot.

`text.placeholder` stays sub-AA by design and remains legitimate **only** inside
`::placeholder`, where WCAG exempts it. It is currently used correctly in all 7
sites; keep it that way.

### 1.3 New tokens

| token | value | purpose |
|---|---|---|
| `control.primary` | `#F4F4F5` | near-white fill for active tabs / secondary CTAs (15.83:1) |
| `control.onPrimary` | `#18181B` | text on the above |
| `bg.rowTint` | `rgba(255,255,255,0.03)` | translucent inner rows |

### 1.4 Green: unchanged value, shrunken usage

`accent.*` keeps its exact hexes (`#3BE38F` measures 11.85:1 as text on the new
page colour). What changes is **where it is allowed**:

- **Allowed:** status dots and chips, links, focus rings, and **exactly one
  action per screen** — that screen's primary.
- **Replaced by `control.primary`:** active feed/tag/leaderboard tabs, active
  filter chips, toggle-selected states, and every secondary CTA.

"One per screen" is a rule, not a judgement call. The green action per screen:

| screen | green | near-white |
|---|---|---|
| feed `/` | Post a project | tabs, window switch, sidebar CTAs |
| composer `/new`, `/edit` | Publish | Save draft, status/visibility toggles |
| project detail | — (Upvote keeps its own voted state) | Bookmark, Share, Edit |
| profile `/u/[username]` | Follow | Edit profile, Résumé, tabs |
| tag `/tag/[slug]` | Follow stack | tabs |
| settings | Save changes | avatar upload, role chips |
| onboarding | Create my profile | role chips, student toggle |
| login | Send magic link | GitHub / Google (secondary) |
| leaderboard, search, notifications, bookmarks | none | all controls |

Where a screen has no creation/commit action, it has no green — that is
intended, not an omission.

Borders keep their current values — `rgba(255,255,255,0.12 / 0.08 / 0.22)` is
already within a hair of the reference's `#ffffff1a`.

---

## 2. Geometry

### 2.1 Radius scale

| token | current | new |
|---|---|---|
| `--radius-xs` | — (new) | `6px` |
| `--radius-control` | `6px` | `8px` |
| `--radius-control-lg` | `7px` | `10px` |
| `--radius-card` | `10px` | `14px` |
| `--radius-card-lg` | `11px` | `18px` |
| `--radius-pill` | — (new) | `9999px` |

145 existing `var(--radius-*)` references update for free — that is the payoff
of the B5 dedupe. The 59 raw literals B5 deliberately left pending "a real scale
decision" are resolved here:

| literal | count | maps to |
|---|---|---|
| `rounded-[8px]` | 19 | `--radius-control` |
| `rounded-[9px]` | 11 | `--radius-control-lg` |
| `rounded-[4px]` | 11 | `--radius-xs` |
| `rounded-[3px]` | 4 | `--radius-xs` |
| `rounded-[5px]` | 14 | **case-by-case — see below** |

`rounded-[5px]` is not a blanket replace. It is the shared `pill`/`chip` shape in
`components/ui/control-classes.ts` *and* small square-ish controls such as
markdown-field's Write/Preview toggle. Only the **tab and filter controls** become
`--radius-pill`; the rest become `--radius-xs`. Each of the 14 gets looked at.

### 2.2 Shadows

Accent glows are **deleted**, not reduced — all 8 sites, plus the
`--shadow-accent-glow` / `--shadow-accent-glow-lg` tokens created in B4. Leaving
unused tokens behind is worse than removing them.

`--shadow-popover` stays. The reference has no shadows at all, but its popovers
sit on `#171717` against a `#0a0a0a` page — separation by lightness. CoBuild's
overlays sit on `bg.raised`, which is a smaller step, so the soft shadow is still
carrying real work for toasts and the author hover card.

`--color-accent-rgb` survives the glow removal: it remains the cleanest way to
compose the green CTA's hover/active states.

---

## 3. Typography

Plus Jakarta Sans stays. It is distinctive, and it is already vendored as raw
`ttf` for the OG cards — satori cannot parse `woff2`, so changing the typeface
would mean reworking those too, for no gain.

**Monospace retreats from texture to meaning.** It currently appears at 75 sites
across 26 files. It keeps only genuinely code-ish contexts — tag slugs/chips and
code blocks — and gives up `@handles`, vote/comment counts, stat figures and
section labels, which move to sans 600.

**Micro-labels adopt the reference's recipe:** 10px, weight 400, 3px tracking,
uppercase, in `text.tertiary`. This applies to section headers such as
"DISCOVERY" / "TOP DEVELOPERS" equivalents in the sidebars and panel headings.
It is the cheapest single move toward the premium read.

---

## 4. Component treatment

These are rules, not a file list; the plan will enumerate sites.

- **Tabs and filter pills** — 32px tall, 12px/600, `--radius-pill`. Active:
  `control.primary` fill with `control.onPrimary` text. Inactive: `bg.rowTint`
  with a `border.default` hairline and `text.secondary`.
- **Panels/cards** — page-coloured, `--radius-card-lg`, `border.default`
  hairline, no brightness step and no shadow. `colors.ts` already argues for
  separation by border rather than brightness; this applies it consistently.
- **List rows** (sidebar nav, tag rows, leaderboard rows) — `bg.rowTint` +
  hairline at `--radius-control-lg`.
- **Primary CTA** — stays green, one per screen.
- **Secondary buttons** — `bg.rowTint` + hairline, near-white text.

---

## 5. Files affected

| file | change |
|---|---|
| `packages/tokens/src/colors.ts` | source of truth: surfaces, text tiers, new tokens |
| `apps/web/src/app/globals.css` | hand-maintained mirror + radii + shadow removal |
| `apps/web/src/components/ui/control-classes.ts` | pill/chip shape + active/inactive treatment |
| ~26 files using `font-mono` | mono retreat |
| 59 raw radius literals | onto the new scale |
| 8 glow sites | shadow removal |

The two token files **must move together** — `globals.css` is a manual copy of
`colors.ts`, and mobile will read the TS file directly. A change landing in only
one drifts silently.

---

## 6. Verification

1. **Contrast, measured not eyeballed.** Re-run the ratio script against all six
   new surfaces. Every text tier ≥ 4.5:1; `placeholder` exempt and confined to
   `::placeholder`.
2. `turbo run typecheck` 4/4 and `next build` clean.
3. **Look at it.** Feed, project detail, profile, composer, settings, search,
   leaderboard — in a **foregrounded** browser tab. A hidden automation tab never
   fires `requestAnimationFrame`, so pages stick on skeletons and read as broken;
   see `PROJECT_INFO.md`.
4. **OG cards re-rendered.** `lib/og/theme.ts` imports `colors` directly, so the
   palette change reaches the social cards. Re-render the project and profile
   cards and confirm they still read correctly against the new surfaces.
5. **Badge SVG re-checked** — `/badge/[username]` also imports `colors`.

---

## 7. Risks

- **This partially supersedes B6.** Every text tier is re-measured and re-set.
  The method and the script carry over; the specific hexes do not.
- **OG cards and the README badge inherit the palette** through `@cobuild/tokens`.
  They are easy to forget because they are not pages. Both are in the
  verification list.
- **The résumé view is deliberately off-palette** (`/u/[username]/resume` uses
  local light literals because it renders for paper). It must **not** be swept
  into a find-and-replace.
- **Scale of edit.** 189 accent references and 75 mono sites is a wide diff.
  Landing it as one commit would be unreviewable; the plan should stage it —
  tokens first, then radii, then mono, then component treatment — with a build
  at each stage.
