# LX Tennis Setups: vision

This is the single source of truth for what we're building and the rules we build by.
Read it before you plan, build or review anything in this repo.

## How to read it

Every rule here is labelled with who owns it, because that decides who you talk to about it:

- **Ben's decisions.** Ben made these calls. Follow them. If a request conflicts with one, raise it with Ben. Don't quietly deviate.
- **Team conventions.** The way the team builds today. Follow them too, but they aren't Ben's calls: the team can change one through review (raise it with your teammate, not Ben), and updates this doc in the same change.
- **Current state** describes the code as it is today, not a target.
- **Open questions** and **Proposals awaiting Ben** are not decided. Don't build on them as if they were, and don't settle them yourself.

## What and why (Ben's decision)

A site where Ben and his tennis friends record the racquets and string setups they've tested, with each person's own scores and reviews side by side.

Why: published online reviews often don't match how the group feels a frame or string plays. This is the group's own record, in their own words and scores.

## Who it's for (Ben's decision)

- Ben and his tennis friends: Michal, Otavio, and more over time.
- Used on a phone, at the court.

## Core flow (Ben's decision)

**Racquets → a racquet (e.g. Yonex EZONE 98) → Ben's, Michal's and Otavio's reviews.**

## Product rules (Ben's decisions)

1. **A score belongs to a setup, not to a racquet or a string on its own.** A setup is:
   - the racquet;
   - **full bed** (one string throughout): the string used, its gauge and one tension; or
   - **hybrid** (different strings in the mains and crosses): a string, gauge and tension for the **Mains**, and a string, gauge and tension for the **Crosses**;
   - the date strung. Restringing the same combination on a new date makes a new setup.

   When entering a setup, choosing "Hybrid" reveals separate **Mains:** and **Crosses:** entry areas, each with its own string, gauge and tension.
2. **One review per person per setup.**
3. **Side by side.** All reviewers' scores for a setup appear together, on the same criteria.
4. **Scoring criteria:** power, control, comfort, spin and feel. Every review scores all five: a reviewer can't leave a criterion blank.
5. **Scores are whole numbers from 1 to 10.** No half points.
6. **Tension is shown in both lb and kg.** Every tension entry has a field for each unit. Whatever the user types in one fills in the equivalent in the other automatically, rounded to 1 decimal place.
7. **Reviews and setups are entered on the site through a shared entry form.** Ben and his friends use the same form; no one edits data files by hand to add a review.
8. **Phone-first.** Design for a phone at the court first, then scale up to desktop.
9. **Never invent reviews, scores or reviewers.** No placeholder or sample data dressed up as real. If there's nothing yet, show an honest empty state.
10. **Racquet specs come only from official manufacturer sources**, each with its source URL. Internet Archive links to the official page are fine (and needed once the manufacturer replaces a model's page).
11. **Specs the manufacturer doesn't publish are left out, not guessed.** For example, Yonex doesn't publish RA (stiffness) or swingweight, so the site doesn't show them.
12. **Racquet photos are official manufacturer photos, all from the same angle.**
13. **The racquet line-up is Ben's choice.** Today it's:
   - Yonex EZONE 98 (2022, 7th gen)
   - Yonex VCORE 98 (2023, 7th gen)
   - Yonex PERCEPT 97 (2023)

Caveat (not a decision): the product photos are Yonex's copyrighted images. The team's view is that this is fine for a private hobby site. If the site ever goes public, Ben decides what to do about them (see Open questions).

## Theme

### Ben's decision

**Synthwave on every page, now and in the future:** retro neon purple, pink and blue on a dark background. It must stay consistent across the whole site. A new page that doesn't look like the rest of the site is a bug.

### Team conventions

1. **Colours only via the semantic tokens** in `src/app/globals.css` (`--color-*`, `--glow-*`, `--text-glow-*`). No raw hex or `rgb()` in components or CSS Modules, and no reaching into the `--palette-*` layer directly. The palette sits under the semantic tokens so the whole site can be re-tuned in one block.
2. **Use a token where one exists** for other design values too: fonts (`--font-display`, `--font-body`), type sizes (`--font-size-*`), spacing (`--space-*`), radii (`--radius-*`), `--content-width`, focus ring and motion durations.
3. **Contrast:** text and accent tokens meet WCAG AA (4.5:1) against `--color-bg` and `--color-surface`. The measured ratios are in the header comment of `globals.css`. A new colour token needs its ratio checked and recorded there.
4. **Breakpoints.** CSS custom properties can't be used inside `@media`, so the scale is written down here. Styles are mobile-first (`min-width` queries). The code uses exactly two:

   | Breakpoint | Used for |
   | --- | --- |
   | `48rem` (768px) | wider page padding (`layout.module.css`), landing grid goes to 3 columns (`page.module.css`) |
   | `56rem` (896px) | racquet page goes to photo + details columns (`racquets/[slug]/page.module.css`) |

   Reuse these. If a new one is really needed, add it to this table in the same change.
5. **Image `sizes` track the CSS.** The `sizes` prop passed to `RacquetPhoto` must match the photo's rendered width at each breakpoint. Change the CSS width and the `sizes` string together.
6. **`src/app/icon.svg` hard-codes hex values**, because it's a static file and can't read CSS variables. They mirror these palette tokens:

   | Hex | Token |
   | --- | --- |
   | `#0b0220` | `--palette-night-950` |
   | `#ffd23f` | `--palette-sunset-yellow` |
   | `#ff3cac` | `--palette-neon-pink` |
   | `#2de2e6` | `--palette-neon-cyan` |

   If one of those tokens changes, update `icon.svg` in the same change.
7. **Motion respects `prefers-reduced-motion`.** The global rule in `globals.css` switches animations off; don't override it.

## Stack and code

### Ben's decision

**Next.js App Router + TypeScript.** (The code is on Next.js 16 and React 19, and needs Node.js 20.9 or newer. This Next version differs from older training data, so read the guides in `node_modules/next/dist/docs/` before writing Next code.)

### Team conventions

- **CSS Modules plus `globals.css`. No Tailwind.** One `*.module.css` file next to the component or page it styles.
- **Server components by default.** Add `'use client'` only where a component really needs browser interactivity. (No client components exist today.)
- **Data only through the async accessors in `src/data`** (today `getRacquets`, `getRacquet`, `getRacquetSlugs` in `src/data/racquets.ts`). Pages never reach into the raw data. This is what lets the data move to a database later by rewriting the accessor bodies without touching pages.
- **TypeScript in strict mode.**
- **Files are kebab-case** (`site-header.tsx`), **components are named exports** (`export function SiteHeader`). Next's route files (`page.tsx`, `layout.tsx`, `not-found.tsx`) use the default export Next requires.
- **Import from `src` with the `@/` alias**, e.g. `@/components/racquet-photo`.
- **Typed routes:** `PageProps<"/route">` and `LayoutProps<"/route">` are global types generated by Next (`next dev`, `next build` or `next typegen`), not imported.
- **Fonts** come from `next/font/google` in `src/app/layout.tsx` and reach CSS as variables (`--font-geist-sans`, `--font-orbitron`).
- **Accessibility basics stay in place:** skip link to `#main`, one `<main id="main">` per page, headings in order, a visible focus ring, and meaningful `alt` text.
- **Comments explain why**, not what, and point at things that must change together.
- **Adding a racquet** follows the existing pattern:
  - Specs and their source URLs (plus archive links) live as comments next to each racquet in `src/data/racquets.ts`.
  - The photo is the face-on product shot, trimmed and centred on an identical 1000 × 1500 transparent canvas so every racquet shows at the same scale, stored as WebP in `public/racquets/`.
  - The slug follows `brand-model-year`, e.g. `yonex-ezone-98-2022`.

## Current state

What exists in the code today:

- **`/`**: landing page with the hero and a card per racquet.
- **`/racquets/[slug]`**: racquet photo, a table of official specs, and a Reviews panel that shows an empty state ("No reviews yet").
- **404 page** in the theme.
- `/racquets` on its own has no page yet (it returns 404).
- Racquet pages are prerendered at build time (`generateStaticParams`, `dynamicParams = false`, no revalidation), so new data currently needs a rebuild.
- Shared components: `SiteHeader` (header for inner pages) and `RacquetPhoto` (photo on a light "display case" stage so dark frames stay visible).
- Data: a typed in-code array in `src/data/racquets.ts` holding the three racquets from the line-up. The slug is the key.
- Not built yet: strings, setups, reviewers, reviews, scores. No review data exists.
- No tests, no CI, not deployed.

## Other decisions by Ben

- **Hosting is postponed on purpose.** Ben is on limited Wi-Fi. (Which host is still open.)
- **The repo is private.**
- **The site is called "LX Tennis Setups".** Write it exactly like that in text: page and tab titles, metadata, alt text, docs and messages. On the site itself, headings and the header brand may display it in all caps through CSS (`text-transform: uppercase`), as they do now. Ben likes that look. The repo, folder and package are still named `tennis-setups-website` (whether to rename them is open).

## Open questions (Ben hasn't answered; don't decide these)

- **Entry form access.** How the shared form is protected (e.g. a shared password) and how a reviewer says who they are when submitting.
- **Site visibility.** Who can see the site once it's hosted. If it goes public, the Yonex photos' copyright needs a decision.
- **Auth.** How people log in, and when.
- **Database.** Which one.
- **String catalogue.** Where string data comes from and what it holds.
- **Caching model.** How new reviews show up without a redeploy (revalidation).
- **Hosting provider.** Probably Vercel, not final.
- **Repo name.** Keep `tennis-setups-website` or rename it (which would also mean the local folder, git remote URL and `package.json` name).

## Proposals awaiting Ben (not decided)

- **Racquet page layout.** A racquet page lists its setups. Each setup card shows the setup (full bed or hybrid, string(s), gauge(s), tension(s) in lb and kg, date strung) and a criteria × reviewer score grid. Reviews come first on mobile and use the full width on desktop. *Why:* scores belong to setups, and at the court the scores are what you came for.
- **URL layout.** `/racquets` (index), `/racquets/[slug]`, `/strings`, `/strings/[slug]`, and maybe `/setups/[id]`. *Why:* matches the core flow's "Racquets" step and leaves room for strings and shareable setups.
- **Data model.**
  - `racquet(id, slug unique)`
  - `string`
  - `setup`
  - `reviewer`
  - `review` with `UNIQUE(setup_id, reviewer_id)`
  - `score(review_id, criterion_id, value CHECK range)`

  Stable ids are the keys, not slugs. *Why:* the database itself enforces "one review per person per setup" and valid score ranges, and renaming a slug can't break links between records.
- **Shared UI primitives first.** Extract an inner layout (header + main), `Panel`, `SectionTitle` and a score chip before building new pages. *Why:* shared pieces keep the theme consistent across pages; copying styles page by page makes them drift.
- **Reviewer colours.** Ben pink, Michal cyan, Otavio purple, always shown with the name so colour is never the only cue.

## Priority and roadmap order (Ben's decision)

1. **LX Tennis Setups website** (this repo): Ben's #1 project.
2. **Ben's portfolio site**: will showcase this site.
3. **tennis-club-app** and **tennis-game** come after those two.

Within this site, the reviews in the core flow aren't built yet, and most of the open questions shape them.

## How to change this doc

- **When Ben decides something, update this doc in the same change as the code, or on its own if there's no code change.** Move the item out of Open questions or Proposals into the section it belongs to (a product rule into Product rules, and so on), or into Other decisions by Ben if nothing fits. Delete it from where it was, so every fact lives in exactly one place.
- **Proposals only become decisions when Ben says so.** Anyone can add a new open question or proposal, clearly labelled.
- **Team conventions change through team review**, in the same change as the code that follows the new convention.
- **Keep Current state true.** When something ships, update it in the same change.
- **Keep it short and plain.** Rules and reasons, not issue lists or task backlogs.
