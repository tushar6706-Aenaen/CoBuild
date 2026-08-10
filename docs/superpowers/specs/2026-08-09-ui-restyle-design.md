# CoBuild UI restyle — design

**Date:** 2026-08-09
**Status:** **implemented** — merged to `main` in PR #1, 2026-08-10

> **Amended 2026-08-10, mid-implementation.** The original spec kept the accent
> green for one action per screen. After seeing the near-white controls land,
> that was overruled: **the palette is now fully monochrome and there is no
> green anywhere.** §1.4 has been rewritten to match what shipped; §8 records
> what implementation taught that the design could not have known.
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

CoBuild ran the opposite playbook before this work: a saturated `#3BE38F` across
189 references and 8 accent-glow shadows, radii clustered tight at 3–11px, and
monospace used as page texture.

**Decision as first written: green becomes an event, not a texture.**
**Decision as shipped: there is no green.** See the amendment in §1.4 — the
reasoning above held, and was simply followed one step further than planned.

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

### 1.4 There is no green

**The palette is monochrome. The accent green is gone — removed, not softened.**

The original plan reserved `#3BE38F` for one action per screen, with a table
assigning the green button on each. That table is deleted rather than corrected,
because keeping it would imply the rule still exists. It does not: no screen has
a green anything.

`accent.*` was repointed rather than removed, so 154 call sites did not have to
churn inside the same change that altered the colour:

| token | was | now | min ratio |
|---|---|---|---|
| `accent.DEFAULT` | `#3BE38F` | `#F4F4F5` | 15.83 |
| `accent.hover` | `#55EAA1` | `#FFFFFF` | 17.40 |
| `accent.onAccent` | `#04180E` | `#18181B` | 16.12 vs DEFAULT |
| `accent.muted` | `#8DEEBB` | `#A1A1A1` | 6.74 |
| `accent.mutedStrong` | `#A5F2C9` | `#D4D4D4` | 11.74 |
| `linkHover` | `#A5F2C9` | `#FFFFFF` | 17.40 |

Emphasis now comes from **lightness alone**: near-white for anything selected or
primary, translucent tint plus a hairline for anything secondary.

**`accent.*` is therefore a redundant alias for `control.*`**, which is the
better name for the same idea. Collapsing them is a mechanical follow-up,
deliberately deferred twice so a 150-site rename never rode along with a colour
change.

The only chroma left in the product is **semantic**, and it stays: `shipped`
cyan, `inProgress` amber, `danger` red, and `code.highlight`. Each means
something; nothing else is allowed to.

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

---

## 8. What implementation changed

Written after the fact. The staging held — tokens, radii, mono, component
treatment, each with typecheck and a build — and shipped as 20 commits.

**Repointing a token is not the same as changing a colour.** Ten sites wrote
`rgba(59,227,143,…)` directly into inline `style` objects and so bypassed the
token layer completely: the sidebar CTA panel, the tag header and its skeleton,
the notification icon wash, the profile role chips, and the login and onboarding
radial backdrops. Every token in the app went neutral and those ten stayed
green. They are now `rgb(var(--color-accent-rgb) / a)`. This is the exact
failure `colors.ts` already documented having been burned by once with
background scrims — a grep for the *token* finds nothing; you have to grep for
the **literal value**.

**`components/ui/control-classes.ts` is a `.ts` file**, so a `--include=*.tsx`
sweep silently misses it — and it holds the `pill` and `chip` shapes every tab
row inherits. Any styling sweep must cover `.ts` too.

**`--color-bg-panel` was set equal to `--color-bg-page`** rather than editing 38
call sites. `panelAlt` and `raised` deliberately did **not** move: 23 hover
states use `raised` as a lift, and flattening it would have made half the app's
hovers invisible. Only the panel tier is page-coloured.

**The OG cards and badge needed design changes, not just token inheritance.**
Both opened with a rule running accent green into status cyan. Once the app went
neutral that band was the only chroma left on either — and a link preview is the
first thing anyone sees of the product. Both now fade near-white into `raised`.

**Typography drift is only visible by rendering.** After the mono retreat the OG
cards still set monospace on the project title, both `@handles` and the stat
figures — the very "mono as texture" usage the app had given up. The code read
fine; the rendered card did not. Five sites now inherit Jakarta.

**Measure every grey.** `#808080`, the intuitive tertiary, fails at 4.41:1 on
the new `bg.raised`. `#828282` is the lowest neutral clearing AA on all six
surfaces. That is the second eyeballed grey to fail on this palette.

**`rounded-[5px]` was two different controls wearing one number** — the shared
pill/chip shape, and small square controls like markdown-field's Write/Preview
toggle. A blanket replace would have turned the latter into lozenges. The 14
sites were split by hand: tabs and filters to `pill`, buttons and containers to
`control`, thumbnails and dropdown rows to `xs`.

**Most visible single change:** project titles moved from mono to sans on the
card, tile, detail page and embed. Correct by the rule that mono means code, but
it is the first place to look if the feel reads wrong.

### Still open

- `accent.*` → `control.*` rename (mechanical, ~150 sites).
- No page was ever reviewed in a foregrounded browser: the extension's
  screenshot API failed throughout with a malformed CDP parameter. Verification
  was the served CSS, the rendered OG PNGs, typecheck and builds — **not human
  eyes on the running app**, apart from the user's own look at the buttons.
