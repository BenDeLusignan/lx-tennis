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

- **Reviewers:** Ben, Michal and Otavio (more over time). They log in to enter setups and reviews.
- **Visitors:** anyone else. They can browse and read everything without logging in, but can't enter or change anything.
- Used on a phone, at the court.

## Core flow (Ben's decision)

**Racquets → a racquet (e.g. Yonex EZONE 98) → Ben's, Michal's and Otavio's reviews.**

The Racquets step has its own page, `/racquets`.

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
7. **Reviews and setups are entered on the site through an entry form that only logged-in reviewers can see** (role-based access):
   - The header has a **Log in** option.
   - Reviewers log in with a **username and password**. There are three accounts, one each for Ben, Michal and Otavio, each with its own password.
   - **Log out** takes the reviewer to the home page.
   - Visitors who aren't logged in only browse; they never see the entry form.
   - Once logged in, a reviewer opens a racquet's page and the entry form is available there as a tab or button, for that racquet. (Tab vs button is a design call for the team.)
   - A review is attributed to the logged-in reviewer; nobody picks a name from a list.
   - No one edits data files by hand to add a review.
8. **Phone-first.** Design for a phone at the court first, then scale up to desktop. On a racquet's page, **Reviews come first on phones**, straight after the racquet's name, and **on desktop Reviews is its own full-width section**. At the court, the scores are what you came for.
9. **Never invent reviews, scores or reviewers.** No placeholder or sample data dressed up as real. If there's nothing yet, show an honest empty state.
10. **Racquet specs come only from official manufacturer sources**, each with its source URL. Internet Archive links to the official page are fine (and needed once the manufacturer replaces a model's page).
11. **Specs the manufacturer doesn't publish are left out, not guessed.** For example, Yonex doesn't publish RA (stiffness) or swingweight, so the site doesn't show them.
12. **Racquet photos are official manufacturer photos, all from the same angle.**
13. **The racquet line-up is Ben's choice.** Today it's:
   - Yonex EZONE 98 (2022, 7th gen)
   - Yonex VCORE 98 (2023, 7th gen)
   - Yonex PERCEPT 97 (2023)

Caveat (not a decision): the product photos are Yonex's copyrighted images. That's fine while the site only runs locally. Visitors won't need to log in, so once it's hosted anyone with the link will see them, and Ben decides what to do about them (see Open questions).

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
   | `48rem` (768px) | wider page padding (`layout.module.css`), racquet cards go to 3 columns (`racquet-list.module.css`), site header goes from two rows (brand, then login state) to one row (`site-header.module.css`) |
   | `56rem` (896px) | racquet page goes from one column (small photo beside the title) to full-width Reviews with the photo beside Specs (`(inner)/racquets/[slug]/page.module.css`); `Panel` padding grows (`panel.module.css`) |

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

**Database: SQLite.** During development it's a single local file, so the site works offline. Where it lives once hosted is decided together with the hosting provider: Turso (hosted SQLite) if the site goes on Vercel, or a plain SQLite file on a host with a permanent disk.

### Team conventions

- **CSS Modules plus `globals.css`. No Tailwind.** One `*.module.css` file next to the component or page it styles.
- **Every page except the landing page lives in the `src/app/(inner)` route group.** Its layout wraps each page in `InnerShell` (`SiteHeader` plus the page's one `<main id="main">`), so pages there render neither. The landing page renders its own hero `<header>` and `<main id="main">`. The root `not-found.tsx` can't sit in a route group, so it uses `InnerShell` directly. *Why:* a page can't forget the header or the skip link's target.
- **Build with the shared pieces in `src/components`** instead of restyling per page: `Panel` for any card or content block (with `href` it's a whole-card link), `SectionTitle` for the pink section heading, `RacquetList` for racquet cards, `AuthStatus` for the login state in a header. Tighten a panel's padding by setting `--panel-padding`, not by overriding `padding`. *Why:* copies drift, and the theme has to look the same on every page.
- **Server components by default.** Add `'use client'` only where a component really needs the browser. Today: `LoginLink` (needs the current path), and on the login page `SubmitButton` (pending label) and `LoginFailed` (moves focus to the username field).
- **Data only through the async accessors in `src/data`** (today `src/data/racquets.ts` and `src/data/reviewers.ts`). Pages never reach into the raw data or the database. *Why:* data can move (in-code array to database, local file to Turso) by rewriting accessor bodies without touching pages.
- **The database schema and client live in `src/db`.** Only `src/data` and the tooling (`drizzle.config.ts`) import `src/db`; pages and scripts go through `src/data`. The schema is Drizzle (`src/db/schema.ts`); after changing it, run `npm run db:generate` and commit the SQL migration in `drizzle/` with it. Never edit a migration that's already been applied; add a new one.
- **Configuration comes from environment variables**, listed with comments in `.env.example`. Real values go in `.env.local`, which is gitignored, as is the local database file. Never commit a secret, a password or a database.
- **Logins and permissions are checked on the server.** `getCurrentReviewer()` (`src/auth/current-reviewer.ts`) returns the logged-in reviewer or null; any Server Action that writes data calls it and refuses when it's null. Hiding UI from visitors is only cosmetic. Changes happen through Server Actions (POST), never GET links. *Why:* anyone can call a Server Action directly, whatever the page shows.
- **Server Actions called from a form end in `redirect()`**, success or failure, and report errors through the URL as a flag (as `/login?failed=1` does), never what the user typed: URLs land in browser history and server logs. *Why:* a form submitted before the page's JavaScript loads is a plain POST; `redirect()` answers it with a 303 to a full page, while returning a value renders only the streamed part of the page, which shows as a blank screen.
- **Keep pages in the static shell.** Cache Components is on (`next.config.ts`), so each page is prerendered and only what reads the request (cookies, `searchParams`) renders per request. Put that read in the smallest component you can and wrap it in `<Suspense>`, as `AuthStatus` and the login page's `?next=` and error message do. Keep the space it will fill reserved, so the page doesn't jump when it streams in. *Why:* a request read outside `<Suspense>` fails the build, and one high up would make the whole page wait. (The boring alternative, Cache Components off, renders every page in full per request: cheap for this site, but no static shell.)
- **Unit tests** use Node's built-in `node:test`, run through `tsx` (`npm test`), in a `*.test.ts` file next to the code. Test rules and security checks (redirects, sessions, passwords), not wiring.
- **TypeScript in strict mode.**
- **Files are kebab-case** (`site-header.tsx`), **components are named exports** (`export function SiteHeader`). Next's route files (`page.tsx`, `layout.tsx`, `not-found.tsx`) use the default export Next requires.
- **Import from `src` with the `@/` alias**, e.g. `@/components/racquet-photo`.
- **Typed routes:** `PageProps<"/route">` and `LayoutProps<"/route">` are global types generated by Next (`next dev`, `next build` or `next typegen`), not imported.
- **Fonts** come from `next/font/google` in `src/app/layout.tsx` and reach CSS as variables (`--font-geist-sans`, `--font-orbitron`).
- **Accessibility basics stay in place:** skip link to `#main` (in the root layout), one `<main id="main">` per page, headings in order, a visible focus ring, and meaningful `alt` text.
- **Comments explain why**, not what, and point at things that must change together.
- **Adding a racquet** follows the existing pattern:
  - Specs and their source URLs (plus archive links) live as comments next to each racquet in `src/data/racquets.ts`.
  - The photo is the face-on product shot, trimmed and centred on an identical 1000 × 1500 transparent canvas so every racquet shows at the same scale, stored as WebP in `public/images/racquets/`.
  - The slug follows `brand-model-year`, e.g. `yonex-ezone-98-2022`.
- **Static images live under `public/images/`**, never straight in `public/`. *Why:* files in `public/` are served from the site root, so `public/racquets/` would share URLs with the `/racquets` pages.

## Current state

What exists in the code today:

- **`/`**: landing page with the hero and a card per racquet. The hero has the login state in its top row.
- **`/racquets`**: the same racquet cards under a "Racquets" heading.
- **`/racquets/[slug]`**: the racquet's name, then a Reviews panel that shows an empty state ("No reviews yet"), then a table of official specs. On phones a small photo sits beside the name; on desktop Reviews spans the full width and the photo sits beside Specs.
- **`/login`**: reviewer log in (username and password). A wrong username or password redirects to `/login?failed=1` with one generic error, and focus moves to the username field (both fields are empty after the reload). On success it sets a signed, httpOnly, SameSite=Lax session cookie (Secure in production) that lasts 30 days, and goes back to the page in `?next=` if that's a path on this site, otherwise home. Works before the page's JavaScript has loaded.
- **Header login state** (`AuthStatus`, in `SiteHeader` and the landing hero): **Log in** for visitors (hidden on `/login`); the reviewer's name and a **Log out** button (a Server Action that goes to the home page) once logged in. On phones the site header has two rows, brand then login state; from 48rem, one. Resetting a reviewer's password or changing `SESSION_SECRET` logs them out. Logging out only deletes the cookie in that browser: a copied cookie stays valid until it expires or the password is reset.
- **404 page** in the theme, with the site header.
- **Rendering:** Cache Components (Partial Prerendering) is on. Every page is prerendered as a static shell at build time (racquet pages via `generateStaticParams`), including the login form; only the header's login state and the login page's `?next=` and error message stream in per request. Responses are `Cache-Control: private, no-store` because of that personal part. An unknown racquet slug renders on request and gets the 404 via `notFound()` (Cache Components doesn't allow `dynamicParams = false`). No revalidation, so new racquet data still needs a rebuild.
- Shared components in `src/components`: `InnerShell` (header + `<main>` for every page but the landing page), `SiteHeader`, `AuthStatus` (login state), `LoginLink`, `Panel` (card and content-block surface), `SectionTitle` (pink section heading), `RacquetList` (racquet cards, used on `/` and `/racquets`) and `RacquetPhoto` (photo on a light "display case" stage so dark frames stay visible).
- Data: a typed in-code array in `src/data/racquets.ts` holding the three racquets from the line-up. The slug is the key. Photos are in `public/images/racquets/`.
- **Database:** SQLite through Drizzle ORM and `@libsql/client`, set by `DATABASE_URL` (`file:local.db` locally; a Turso URL plus `DATABASE_AUTH_TOKEN` later, with no code change). One table, `reviewer` (id, unique lowercase username, non-blank display name, scrypt password hash), seeded by migration with Ben, Michal and Otavio (usernames `ben`, `michal`, `otavio`) and no passwords. Passwords are set only with `npm run db:set-password -- <username>`; there is no way to add accounts (see Open questions). Setup steps and scripts are in the README.
- Not built yet: strings, setups, reviews, scores, the entry form. No review data exists.
- No CI, not deployed.

## Other decisions by Ben

- **Hosting is postponed on purpose.** Ben is on limited Wi-Fi. (Which host is still open.)
- **The repo is private.**
- **The site is called "LX Tennis Setups".** Write it exactly like that in text: page and tab titles, metadata, alt text, docs and messages. On the site itself, headings and the header brand may display it in all caps through CSS (`text-transform: uppercase`), as they do now. Ben likes that look. The repo, folder and package are still named `tennis-setups-website` (whether to rename them is open).

## Open questions (Ben hasn't answered; don't decide these)

- **Photo copyright once hosted.** Visitors can view the site without logging in, so once it's hosted the Yonex photos are visible to anyone with the link. Keep them, or replace them?
- **More reviewer accounts.** How accounts beyond the first three (Ben, Michal, Otavio) get added.
- **String catalogue.** Where string data comes from and what it holds.
- **Caching model.** How new reviews show up without a redeploy (revalidation).
- **Hosting provider.** Probably Vercel, not final. This also settles where the database lives (see Stack and code).
- **Repo name.** Keep `tennis-setups-website` or rename it (which would also mean the local folder, git remote URL and `package.json` name).

## Proposals awaiting Ben (not decided)

- **Racquet page layout.** A racquet page lists its setups. Each setup card shows the setup (full bed or hybrid, string(s), gauge(s), tension(s) in lb and kg, date strung) and a criteria × reviewer score grid. *Why:* scores belong to setups.
- **URL layout.** `/strings`, `/strings/[slug]`, and maybe `/setups/[id]`, alongside the existing `/racquets` and `/racquets/[slug]`. *Why:* leaves room for strings and shareable setups.
- **Data model.**
  - `racquet(id, slug unique)`
  - `string`
  - `setup`
  - `reviewer`
  - `review` with `UNIQUE(setup_id, reviewer_id)`
  - `score(review_id, criterion_id, value CHECK range)`

  Stable ids are the keys, not slugs. *Why:* the database itself enforces "one review per person per setup" and valid score ranges, and renaming a slug can't break links between records.
- **Shared UI primitives first.** Extract a score chip before building the score grid. *Why:* shared pieces keep the theme consistent across pages; copying styles page by page makes them drift.
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
