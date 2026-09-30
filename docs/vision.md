# LX Tennis: vision

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
- Ben, Michal and Otavio are men; use he/him for them in docs and copy.

## Core flow (Ben's decision)

**Racquets → a racquet (e.g. Yonex EZONE 98) → Ben's, Michal's and Otavio's reviews.**

The Racquets step has its own page, `/racquets`.

## Product rules (Ben's decisions)

1. **A score belongs to a setup, not to a racquet or a string on its own.** A setup is:
   - the racquet;
   - a string, gauge and tension for the **Mains**, and a string, gauge and tension for the **Crosses**:
     - **full bed**: one string and gauge throughout; the mains and crosses tensions can be the same or different;
     - **hybrid**: any strings, gauges and tensions in the mains and crosses;
   - the date strung. Restringing the same combination on a new date makes a new setup.

   **Gauge is in millimetres** (e.g. 1.25 mm), the unit every brand prints.

   When entering a setup, the form always shows a **Mains:** area and a **Crosses:** area, for a full bed as well as a hybrid. A full bed takes one string and gauge (entered in Mains, with Crosses saying it's the same) plus a tension in each area. Choosing "Hybrid" reveals the crosses' own string and gauge, so each area has its own string, gauge and tension.
2. **One review per person per setup, and each setup exists once.** Entering a setup that already exists (same racquet, strings, gauges, tensions and date strung) is refused, and the reviewer is pointed to the existing one to add their review. That way everyone's scores for the same stringing sit side by side, so agreements and disagreements are easy to see.
3. **Side by side.** All reviewers' scores for a setup appear together, on the same criteria. On a racquet's page, each setup is a card:
   - the setup on top: full bed or hybrid, string(s), gauge(s), tensions in lb and kg, date strung;
   - then a score grid with the criteria as rows and the reviewers as columns, so comparing everyone on one criterion means reading across one row; a reviewer who hasn't reviewed that setup shows an empty column, never a made-up score;
   - then the written reviews.
4. **Scoring criteria:** power, control, comfort, spin and feel. Every review scores all five: a reviewer can't leave a criterion blank. A written review alongside the scores is optional.
5. **Scores are whole numbers from 1 to 10.** No half points.
6. **Tension is typed once and shown in both lb and kg.** Each tension is a single number field. The setup has one lb/kg choice that covers all its tensions (mains and crosses alike), with nothing pre-selected: the reviewer must pick one. Accepted values are 30–80 lb (13.6–36.3 kg), with up to 1 decimal place. Wherever a tension is shown, both units appear: the value typed first, then its equivalent in the other unit rounded to 1 decimal place (e.g. "55 lb · 24.9 kg").
7. **Reviews and setups are entered on the site through an entry form that only logged-in reviewers can see** (role-based access):
   - The header has a **Log in** option.
   - Reviewers log in with a **username and password**. There are three accounts, one each for Ben, Michal and Otavio, each with its own password.
   - **Log out** takes the reviewer to the home page.
   - Once logged in, the reviewer's **name in the header links to their account page**.
   - Visitors who aren't logged in only browse; they never see the entry form.
   - Once logged in, a reviewer opens a racquet's page and the entry form is available there as a tab or button, for that racquet. (Tab vs button is a design call for the team.)
   - A review is attributed to the logged-in reviewer; nobody picks a name from a list.
   - **A review can be edited only by the reviewer who wrote it**, who can change its scores and written review (the setup itself isn't editable). Nobody can edit someone else's review, and the server enforces it, not just the page.
   - **A reviewer can delete their own review, and only theirs.** Deleting it never touches anyone else's review. When the last review on a setup is deleted, the setup is removed with it; there is no separate way to delete a setup. *Why:* it fixes a setup entered under the wrong racquet by mistake, without one person's mistake costing the others their reviews. Nobody can delete someone else's review, and the server enforces it, not just the page.
   - No one edits data files by hand to add a review.
8. **Phone-first.** Design for a phone at the court first, then scale up to desktop. On a racquet's page, **Reviews come first on phones**, straight after the racquet's name, and **on desktop Reviews is its own full-width section**. At the court, the scores are what you came for.
9. **Never invent reviews, scores or reviewers.** No placeholder or sample data dressed up as real. If there's nothing yet, show an honest empty state.
10. **Racquet specs come only from official manufacturer sources**, each with its source URL. Internet Archive links to the official page are fine (and needed once the manufacturer replaces a model's page).
11. **Every racquet shows the same five specs:** head size, unstrung weight, balance, length and string pattern. Other specs a manufacturer publishes (e.g. Babolat's swingweight, stiffness/RA, beam and recommended tension) aren't shown. A spec in the five that the manufacturer doesn't publish is left out, not guessed.
12. **Racquet photos are official manufacturer photos**, all shown at the same scale. The angle can differ between brands: Yonex's official shots are turned slightly, while Babolat's are flat face-on, for example.
13. **The racquet line-up is Ben's choice.** Today it's:
   - Yonex EZONE 98 (2022, 7th gen)
   - Yonex VCORE 98 (2023, 7th gen)
   - Yonex PERCEPT 97 (2023)
   - Babolat Pure Aero 98 (2023), Otavio's racquet

   Wherever racquets are listed, they're grouped into a section per brand, in this order: **Yonex, Babolat, Head, Tecnifibre, Wilson**. Every brand gets its section, even with no racquets yet, and an empty brand shows an honest "No racquets yet".
14. **Strings.** Each string has a brand, a name and a type. The type is required and comes from a fixed list: polyester, co-polyester, multifilament, synthetic gut, natural gut, Kevlar/aramid.
   - The list starts with these ten, named as the manufacturer writes them, with the manufacturer's own type:
     - Yonex (polyester): POLYTOUR PRO, POLYTOUR FIRE, POLYTOUR DRIVE, POLYTOUR REV, POLYTOUR SPIN
     - Solinco (co-polyester): Hyper-G, Hyper-G Soft, Confidential, Confidential Soft, Mach-10
   - When entering a setup, a reviewer picks each string from the list, or chooses **Add new string** and enters its brand, name and type. It's then on the list for everyone.
   - Any logged-in reviewer can edit a string's brand, name or type (e.g. to fix spelling), and the change shows on every setup that uses it.
   - A string can be deleted only while no setup uses it.

## Theme

### Ben's decision

**Synthwave on every page, now and in the future:** retro neon purple, pink and blue on a dark background. It must stay consistent across the whole site. A new page that doesn't look like the rest of the site is a bug.

**Reviewer colours:** Ben pink, Michal cyan, Otavio purple. A colour is always shown with the reviewer's name, so colour is never the only cue.

**Scores appear as one shared score chip**, built before the score grid and used wherever a score is shown. *Why:* shared pieces keep the theme consistent across pages; copying styles page by page makes them drift.

### Team conventions

1. **Colours only via the semantic tokens** in `src/app/globals.css` (`--color-*`, `--glow-*`, `--text-glow-*`). No raw hex or `rgb()` in components or CSS Modules, and no reaching into the `--palette-*` layer directly. The palette sits under the semantic tokens so the whole site can be re-tuned in one block.
2. **Use a token where one exists** for other design values too: fonts (`--font-display`, `--font-body`), type sizes (`--font-size-*`), spacing (`--space-*`), radii (`--radius-*`), `--content-width`, focus ring and motion durations.
3. **Contrast:** text and accent tokens meet WCAG AA (4.5:1) against `--color-bg` and `--color-surface`. The measured ratios are in the header comment of `globals.css`. A new colour token needs its ratio checked and recorded there.
4. **Breakpoints.** CSS custom properties can't be used inside `@media`, so the scale is written down here. Styles are mobile-first (`min-width` queries). The code uses exactly two:

   | Breakpoint | Used for |
   | --- | --- |
   | `48rem` (768px) | wider page padding (`layout.module.css`), racquet cards go to 3 columns (`racquet-list.module.css`), more space between brand sections (`racquets-by-brand.module.css`), site header goes from two rows (brand, then login state) to one row (`site-header.module.css`), score buttons on the entry forms go from two rows of five to one row of ten (`review-fields.module.css`), the new-setup form's Mains and Crosses sit side by side (`(inner)/account/racquets/[slug]/new/page.module.css`), a string's edit fields on `/account/strings` share one row (`(inner)/account/strings/page.module.css`) |
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
8. **Reviewer colours** are the `--color-reviewer-*` tokens (Ben pink, Michal cyan, Otavio purple; `--color-reviewer-other` for a reviewer without one yet), picked by username in `src/components/reviewer-color.ts`. Show a reviewer's name with `ReviewerName`, which always pairs the colour with the name. Reviewer-coloured text never sits on `--color-surface-raised`, where pink and purple drop just below 4.5:1. Setup cards sit on `--color-bg`.

## Stack and code

### Ben's decision

**Next.js App Router + TypeScript.** (The code is on Next.js 16 and React 19, and needs Node.js 20.9 or newer. This Next version differs from older training data, so read the guides in `node_modules/next/dist/docs/` before writing Next code.)

**Database: SQLite.** During development it's a single local file, so the site works offline. Where it lives once hosted is decided together with the hosting provider: Turso (hosted SQLite) if the site goes on Vercel, or a plain SQLite file on a host with a permanent disk.

**Data model.** Stable ids are the keys, not slugs, and the database enforces the product rules where it can:

- `racquet`: id and unique slug only. Specs, photos and sources stay in `src/data/racquets.ts`, keyed by slug.
- `string`: brand, name and type (one of the types in Product rule 14), unique by brand and name. A string that a setup uses can't be deleted.
- `setup`: its racquet, date strung, its tension unit (lb or kg), and a string, gauge and tension for both the mains and the crosses.
  - Full bed or hybrid isn't stored: a setup is a full bed when its mains and crosses have the same string and gauge. That way the same stringing can't be entered once as each.
  - Each tension is stored as the number typed; the database calculates it in kg to 1 decimal place from that number and the unit, so the two can never disagree.
  - A duplicate setup is refused (Product rule 2), comparing tensions by that kg value, so 55 lb and 24.9 kg count as the same, and so do 54.9 lb and 55 lb (both 24.9 kg).
- `review`: its setup and reviewer, unique together; the five scores as required whole-number columns checked to be 1–10 (so adding a criterion means a migration); an optional written review.

*Why:* the database itself enforces one review per person per setup, all five scores, valid score ranges and no duplicate setups, and renaming a slug can't break links between records.

**Freshness: a page is refreshed when something is saved.** Racquet pages, reviews included, stay ready-made and are served instantly. Saving or editing a setup, review or string, or deleting a review or string, refreshes the racquet pages it affects straight away, so a reviewer sees their change right after saving, and so does everyone else from then on. The refresh lives in the save code in `src/data`, not on pages, so a new way of changing data can't forget it. *Why:* fastest for visitors at the court, with no stale window after a save.

### Team conventions

- **CSS Modules plus `globals.css`. No Tailwind.** One `*.module.css` file next to the component or page it styles.
- **Every page except the landing page lives in the `src/app/(inner)` route group.** Its layout wraps each page in `InnerShell` (`SiteHeader` plus the page's one `<main id="main">`), so pages there render neither. The landing page renders its own hero `<header>` and `<main id="main">`. The root `not-found.tsx` can't sit in a route group, so it uses `InnerShell` directly. *Why:* a page can't forget the header or the skip link's target.
- **Build with the shared pieces in `src/components`** instead of restyling per page: `Panel` for any card or content block (with `href` it's a whole-card link), `SectionTitle` for the pink section heading, `Button` for buttons and button-like links (`primary` filled pink for a form's main action, `secondary` cyan outline otherwise; with `href` it's a link; `disabled` looks unavailable and always sits beside its reason), `BackLink` for the "← somewhere" link at the top of a page, `RacquetsByBrand` wherever racquets are listed (it renders `RacquetList`, the racquet cards, per brand), `EmptyState` for every "nothing here yet" (`compact` for a one-line slot in a list), `AuthStatus` for the login state in a header, `LogOutButton` wherever Log out appears. For setups and scores: `ScoreChip` wherever a score is shown (Ben's decision; a parent tints it through `--score-chip-color`, `--score-chip-fill` and `--score-chip-text`), `ReviewerName` wherever a reviewer's name goes with their colour, `SetupCard` for a setup with its grid and written reviews (built from `SetupSummary` and `ScoreGrid`, which are also used on their own), `AddReviewButton` for the logged-in reviewer's "Add your review" (on a racquet's page it swaps in `EditReviewLink`, "Edit your review", for a setup they've reviewed). For forms: `Field` (label above control) with `Input`, `Select` or `TextArea` for every field, `ReviewFields` for the five scores and the written review, `SubmitButton` for a form's main submit (pending label), `FormActions` for the Save + Cancel row at the foot of a review form (two equal columns, as wide as the fields above; give both buttons `fill`), `FormMessage` for the result of a submit read from a URL flag. Tighten a panel's padding or change its background by setting `--panel-padding` or `--panel-background` (setup cards set the background to `--color-bg`), not by overriding `padding` or `background`: two CSS Modules setting the same property would depend on which stylesheet loads last. *Why:* copies drift, and the theme has to look the same on every page.
- **Server components by default.** Add `'use client'` only where a component really needs the browser. Today: `LoginLink` and `AccountLink` (need the current path), `SubmitButton` (pending label), `FormMessage` (moves focus to itself), on the login page `LoginFailed` (moves focus to the username field), and on the new-setup page `SetupFormConstraints` and `TensionHint` (see the forms convention below).
- **Forms work before JavaScript loads, and JavaScript only adds to them.**
  - What a form shows or hides (Full bed / Hybrid, "Add new string…") is decided by CSS on the form's own state (`:has(:checked)`), so the reveals work before any script runs.
  - A hidden field must not be `required`, or the browser blocks the submit with an error nobody can see. Fields required only while shown carry `data-required-when-shown`; once JavaScript loads, `SetupFormConstraints` sets `required` from whether they're visible, so CSS stays the one place that decides. Until then, the server's checks catch them.
  - Use HTML's own checks (`required`, `min`, `max`, `step`, `maxLength`) with the same limits as the server (`src/data/units.ts`, `src/data/limits.ts`), so most mistakes are caught before a submit reloads the page and empties the form.
  - Each URL error flag maps to a message that says what to fix and that nothing was saved, shown with `FormMessage`.
  - A choice between a few options is radios in a `fieldset` with a `legend`, not a select: one tap each. The exceptions are the string list (long, and grouped by brand) and a string's type (six fixed options): selects, because six radios would stack into a tall list on a phone. Touch targets are at least 2.75rem (44px).
- **Data only through the async accessors in `src/data`** (`racquets.ts`, `reviewers.ts`, `setups.ts`, `strings.ts`; plus `units.ts` and `limits.ts`, which are pure, with no `server-only`, so client components can use them too). Pages never reach into the raw data or the database. *Why:* data can move (in-code array to database, local file to Turso) by rewriting accessor bodies without touching pages.
- **Freshness is built into `src/data`.** A reader whose data belongs in the static shell is `'use cache'` with `cacheLife("max")` and a `cacheTag`. Every writer in `src/data` calls `updateTag` for what it changed, after its transaction commits, so no caller can forget the refresh. The tags live in `src/data/cache-tags.ts`, next to what each one covers. A tag set inside a cached reader also expires the prerendered page that used it. `updateTag` only works inside a Server Action, so the writers are for Server Actions only.
- **The database schema and client live in `src/db`.** Only `src/data` and the tooling (`drizzle.config.ts`) import `src/db`; pages and scripts go through `src/data`. The schema is Drizzle (`src/db/schema.ts`); after changing it, run `npm run db:generate` and commit the SQL migration in `drizzle/` with it. Never edit a migration that's already been applied; add a new one.
- **Configuration comes from environment variables**, listed with comments in `.env.example`. Real values go in `.env.local`, which is gitignored, as is the local database file. Never commit a secret, a password or a database.
- **Logins and permissions are checked on the server.** `getCurrentReviewer()` (`src/auth/current-reviewer.ts`) returns the logged-in reviewer or null; any Server Action that writes data calls it and refuses when it's null. Hiding UI from visitors is only cosmetic. Changes happen through Server Actions (POST), never GET links. *Why:* anyone can call a Server Action directly, whatever the page shows.
- **Reviewers-only pages live under `/account` and are checked twice.** `src/proxy.ts` matches `/account/:path*` and sends a page load (GET/HEAD) without a valid session cookie to `/login?next=…` with a real 307 before anything renders; and the page itself calls `getCurrentReviewer()` inside the streamed part and `redirect()`s to log in when it's null, as `/account` does. The page's check is the security boundary; the proxy's is only the quick one (it can't see a password reset without the database), and it lets POSTs through because Server Actions check for themselves. *Why:* with a static shell the page has already started sending by the time it reads the cookie, so its own `redirect()` can only arrive as a `<meta>` refresh inside a 200, which is a second late and wrong for anything that isn't a browser.
- **Server Actions called from a form end in `redirect()`**, success or failure, and report errors through the URL as a flag (as `/login?failed=1` does), never what the user typed: URLs land in browser history and server logs. *Why:* a form submitted before the page's JavaScript loads is a plain POST; `redirect()` answers it with a 303 to a full page, while returning a value renders only the streamed part of the page, which shows as a blank screen.
- **Server Actions live in `src/<area>/actions.ts`** (`auth`, `reviews`, `strings`). The ones that write data are thin `'use server'` wrappers: `redirect(await submitX(await getCurrentReviewer(), formData))`. The work is in `src/<area>/submit.ts`: it takes the reviewer (null for a visitor, who's sent to log in before anything else is acted on; the one thing read first is the racquet slug or setup id, checked for shape, to build the page to come back to) and returns the URL to redirect to. Form fields are checked with the helpers in `src/forms/fields.ts`: every field is `unknown` until checked, and everything the database checks is checked first, with a clear error code. *Why:* the submit functions can be tested as a visitor or a reviewer without a Next request, and `redirect()` stays in the one place Next needs it.
- **Keep pages in the static shell.** Cache Components is on (`next.config.ts`), so each page is prerendered and only what reads the request (cookies, `searchParams`) renders per request. Put that read in the smallest component you can and wrap it in `<Suspense>`, as `AuthStatus` and the login page's `?next=` and error message do. Keep the space it will fill reserved, so the page doesn't jump when it streams in. The one exception is a setup's "Add your review" (`AddReviewButton`, which shows "Edit your review" in its place for a setup the reviewer has already reviewed), at the foot of each card: nothing is reserved, so for a logged-in reviewer the content below a card moves down by a button's height when it streams in. *Why:* visitors are most of the audience, and a gap kept free on every card for a button they never see would cost a phone a button's height of empty space per setup. *Why:* a request read outside `<Suspense>` fails the build, and one high up would make the whole page wait. (The boring alternative, Cache Components off, renders every page in full per request: cheap for this site, but no static shell.) The one exception is a page with no ids to prerender, such as `/account/setups/[id]/review`: it awaits its setup's database lookup outside `<Suspense>` (`instant = false`) so an unknown id is a real 404, and only its login check, form and delete area stream in.
- **Unit tests** use Node's built-in `node:test`, run through `tsx` (`npm test`), in a `*.test.ts` file next to the code. Test rules and security checks (redirects, sessions, passwords), not wiring. A test that needs the database imports `@/data/test-database` **first**. That gives the file its own migrated database through the app's `getDb()` (never `local.db`), and stands in for `next/cache` (which only works inside Next), recording every `updateTag` in `refreshedTags`. This needs `--experimental-test-module-mocks`, which `npm test` passes, and Node 25.9 or newer.
- **TypeScript in strict mode.**
- **Files are kebab-case** (`site-header.tsx`), **components are named exports** (`export function SiteHeader`). Next's route files (`page.tsx`, `layout.tsx`, `not-found.tsx`) use the default export Next requires.
- **Import from `src` with the `@/` alias**, e.g. `@/components/racquet-photo`.
- **Typed routes:** `PageProps<"/route">` and `LayoutProps<"/route">` are global types generated by Next (`next dev`, `next build` or `next typegen`), not imported.
- **Fonts** come from `next/font/google` in `src/app/layout.tsx` and reach CSS as variables (`--font-geist-sans`, `--font-orbitron`).
- **Accessibility basics stay in place:** skip link to `#main` (in the root layout), one `<main id="main">` per page, headings in order, a visible focus ring, and meaningful `alt` text.
- **Comments explain why**, not what, and point at things that must change together.
- **Adding a racquet** follows the existing pattern:
  - Set its `brand` to one of `BRANDS` in `src/data/racquets.ts`; which brands exist, and their order, is Ben's call (Product rule 13). The `name` starts with the brand.
  - Specs and their source URLs (plus archive links) live as comments next to each racquet in `src/data/racquets.ts`.
  - The photo is the official face-on product shot, trimmed, scaled to the same 1410px frame height and centred at the top of an identical 1000 × 1500 transparent canvas so every racquet shows at the same scale, stored as WebP in `public/images/racquets/`.
  - The slug follows `brand-model-year`, e.g. `yonex-ezone-98-2022`.
  - Add its row to the `racquet` table with a new migration that inserts the slug (`npm run db:generate -- --custom --name=<name>`, as `drizzle/0003_seed_racquets_and_strings.sql` does). A test fails until every slug in `src/data/racquets.ts` has a row.
- **Static images live under `public/images/`**, never straight in `public/`. *Why:* files in `public/` are served from the site root, so `public/racquets/` would share URLs with the `/racquets` pages.

## Current state

What exists in the code today:

- **`/`**: landing page with the hero, then a "Racquets" heading and the racquets grouped by brand (`RacquetsByBrand`): a section per brand in Product rule 13's order, each with its racquet cards or a compact "No racquets yet". Under the brand heading a card shows just the model ("EZONE 98"); the brand stays in the link's accessible name. The hero has the login state in its top row. Headings: h1 site name, h2 Racquets, h3 brand, h4 racquet name.
- **`/racquets`**: the same brand sections under a "Racquets" page heading. Headings: h1 Racquets, h2 brand, h3 racquet name.
- **`/racquets/[slug]`**: the racquet's name, then the Reviews panel, then a table of official specs. On phones a small photo sits beside the name; on desktop Reviews spans the full width and the photo sits beside Specs.
  - Reviews shows a setup card per setup, newest strung first (one column on phones, as many ~24rem cards as fit on wider screens), or "No reviews yet" when there are none. Each card (`SetupCard`, id `setup-<id>`, where a save lands and which glows while it's the URL's target): the strings as its heading (a hybrid as "mains / crosses"), full bed or hybrid and the date strung, gauge(s) and tensions ("55 lb · 24.9 kg"); then the score grid, a `<table>` with the criteria as row headers and every reviewer as a column header in their colour, a score chip per score and a dashed empty slot ("Not reviewed" to screen readers) for a reviewer who hasn't reviewed; then the written reviews, each under its reviewer's name. Three reviewer columns fit a 360px phone; with four or more, each column keeps a 3.5rem minimum (room for a name and a chip) and the grid scrolls sideways inside the card.
  - For a logged-in reviewer only (streamed in): **Add a setup** beside the Reviews heading (its row keeps a button's height for everyone, so nothing jumps), and at the foot of each card **Add your review** if they haven't reviewed it, or **Edit your review** (`EditReviewLink`) if they have (each named after its setup's heading for screen readers, since every card has one). Visitors never see either, and Edit your review shows only on setups you've reviewed. Unlike Add a setup, these have no reserved space: see Keep pages in the static shell.
  - Headings: h1 racquet name, h2 Reviews, h3 each setup, h4 "Written reviews", h2 Specs.
- **`/login`**: reviewer log in (username and password). A wrong username or password redirects to `/login?failed=1` with one generic error, and focus moves to the username field (both fields are empty after the reload). On success it sets a signed, httpOnly, SameSite=Lax session cookie (Secure in production) that lasts 30 days, and goes back to the page in `?next=` if that's a path on this site, otherwise home. Works before the page's JavaScript has loaded.
- **`/account`**: the logged-in reviewer's display name and username, a link to edit the string list (`/account/strings`), and a **Log out** button. Visitors are sent to `/login?next=%2Faccount` (a 307, from `src/proxy.ts`), so logging in comes back here.
- **`/account/racquets/[slug]/new`** (reviewers only; unknown slug 404s): a new setup plus your review, in one form.
  - Above the form, the racquet's existing setups (summary only), each with **Add your review**, or "You've reviewed this one", so nobody re-enters a setup that's there.
  - The form: date strung (not in the future); Full bed / Hybrid (Full bed pre-selected); the lb/kg choice as two radios with nothing pre-selected; a Mains and a Crosses area. A full bed shows one string and gauge (in Mains) with a tension in each area; Hybrid reveals the crosses' own string and gauge. Each string is picked from the list (grouped by brand, with its type) or "Add new string…", which reveals brand, name and type. Then the five scores and the optional written review (`ReviewFields`). **Save setup** has a **Cancel** link beside it, back to the racquet's page; it's plain navigation, so nothing is saved. The two sit in an equal two-column row (`FormActions`) that's as wide as the fields above, same height, with the long label wrapping inside its button.
  - The reveals are CSS, so they work before JavaScript loads. Once it has: the revealed fields become required, the tensions' min and max follow lb/kg, each tension shows its live conversion ("= 24.9 kg"), and a new string that's already on the list is refused before submitting.
  - Errors from the save come back as `?error=` flags, each with its own message (focused); a duplicate setup goes to that setup's review page instead (`?existing=1`), which says it's already on the site, whether or not you've reviewed it.
  - Headings: h1 Add a setup, h2 Already on this racquet, h3 each setup, h2 New setup and your review.
- **`/account/setups/[id]/review`** (reviewers only; unknown or malformed id 404s): the setup's summary (not the others' scores, so they don't pull yours towards theirs), then your review.
  - If you haven't reviewed it: the add form (scores and written review), with **Save review** and a **Cancel** link beside it (an equal two-column row, `FormActions`, as on the new-setup form), back to the setup's card. Nothing is saved.
  - If you have: the same form filled in with your current scores and written review, headed "Edit your review", with **Save changes** and a **Cancel** link (the same equal row) back to the setup's card. Saving goes to the card. A failed save comes back with a message saying nothing was saved, and the form shows your review as it was.
  - A duplicate setup sent here (`?existing=1`) says so either way.
  - Only for a reviewer who has reviewed it, below the edit form: a separate **Delete your review** panel. A reviewer with no review sees nothing.
    - A short line on why you'd delete it, then "Delete your review…", a `<details>` (so it works before JavaScript loads) that opens to "This deletes your review. It can't be undone.", then either "Other reviewers' reviews stay." or, when yours is the only review, "Yours is the only review, so the setup is deleted too." (read per request), and the real **Yes, delete my review** button, a Server Action POST. Success goes to the setup's card, or to the racquet's page when the setup went with its last review.
    - With no review of your own to delete (a double submit, say), nothing is deleted and it goes back to the review page, which shows the add form, with no message.
  - Headings: h1 Review this setup, h2 the setup, h2 Your review (or Edit your review), h2 Delete your review (only with a review of your own).
- **`/account/strings`** (reviewers only): every string as a collapsed row (brand and name, type, "String tested" when a setup uses it), opening to an edit form (brand, name, type) with Save and Delete. For a string a setup uses, Delete is shown unavailable, with the reason "Tested in a review, so it can't be deleted" (not "in use", which could suggest the string is on a racquet right now). The result of a save or delete (or its error) shows above the list, focused. Headings: h1 Strings.
- Scores are entered by tapping one of ten score chips per criterion (radios, two rows of five on phones, one row from 48rem); arrow keys move between them.
- **Header login state** (`AuthStatus`, in `SiteHeader` and the landing hero): **Log in** for visitors (hidden on `/login`); once logged in, the reviewer's name as a cyan underlined link to `/account` (on `/account` itself it's marked `aria-current="page"` and looks like plain text), then a **Log out** button (a Server Action that goes to the home page). On phones the site header has two rows, brand then login state; from 48rem, one. Resetting a reviewer's password or changing `SESSION_SECRET` logs them out. Logging out only deletes the cookie in that browser: a copied cookie stays valid until it expires or the password is reset.
- **404 page** in the theme, with the site header.
- **Rendering:** Cache Components (Partial Prerendering) is on. Every page is prerendered as a static shell at build time (racquet pages and the new-setup form via `generateStaticParams`), including the login form, the account page's labels and Log out button, the racquet pages' setup cards, the new-setup form with its string list, and `/account/strings`' list; per request, only the header's login state, the login page's `?next=` and error message, the account page's name and username, the reviewer-only buttons, the account pages' login checks and `?error=`/`?saved=` messages, and the review page's form and delete area stream in. The review page (`/account/setups/[id]/review`) has no ids to prerender, so it looks its setup up per request before sending anything (`instant = false`), which is what gives an unknown id a real 404. Responses are `Cache-Control: private, no-store` because of the personal parts. An unknown racquet slug renders on request and gets the 404 via `notFound()` (Cache Components doesn't allow `dynamicParams = false`). Setups, reviews and strings come from cached readers, so the build reads them from the database (`next build` needs `DATABASE_URL`, with migrations applied). A save refreshes the affected pages straight away (Freshness), with no rebuild. Racquet specs are in code, so a change to them still needs a rebuild.
- Shared components in `src/components`: `InnerShell` (header + `<main>` for every page but the landing page), `SiteHeader`, `AuthStatus` (login state), `LoginLink`, `AccountLink` (the header's name link), `LogOutButton`, `Button`, `BackLink`, `Panel` (card and content-block surface), `SectionTitle` (pink section heading), `EmptyState` (dashed "nothing here yet" box: "No reviews yet" on racquet pages, "No racquets yet" for an empty brand, "No strings yet"), `RacquetsByBrand` (a section per brand, used on `/` and `/racquets`), `RacquetList` (one brand's racquet cards), `RacquetPhoto` (photo on a light "display case" stage so dark frames stay visible), `ScoreChip`, `ReviewerName` (with `reviewer-color.ts`), `SetupCard`, `SetupSummary`, `ScoreGrid`, `AddReviewButton`, `EditReviewLink`, and for forms `Field`, `Input`/`Select`/`TextArea`, `ReviewFields` (empty, or filled in with a review to edit), `SubmitButton`, `FormActions` and `FormMessage`.
- Data: a typed in-code array in `src/data/racquets.ts` holding the racquets from the line-up, each with its `brand`. The slug is the key. `getRacquetsByBrand()` returns a section for every brand in the fixed order, empty ones included, and is what `/` and `/racquets` use. Photos are in `public/images/racquets/`.
- **Database:** SQLite through Drizzle ORM and `@libsql/client` (which enforces foreign keys on every connection), set by `DATABASE_URL` (`file:local.db` locally; a Turso URL plus `DATABASE_AUTH_TOKEN` later, with no code change). Setup steps and scripts are in the README. Schema in `src/db/schema.ts`; the rules below are checked by the database and tested in `src/db/schema.test.ts` against a fresh database with every migration applied.
  - `reviewer`: id, unique lowercase username, non-blank display name, scrypt password hash. Seeded by migration with Ben, Michal and Otavio (usernames `ben`, `michal`, `otavio`) and no passwords. Passwords are set only with `npm run db:set-password -- <username>`; there is no way to add accounts (see Open questions).
  - `racquet`: id and unique slug (lowercase letters, digits, hyphens), seeded with the four line-up slugs.
  - `string`: brand, name (both non-blank, no leading or trailing whitespace) and type, stored as `polyester`, `co-polyester`, `multifilament`, `synthetic-gut`, `natural-gut` or `kevlar-aramid`. Unique by brand and name ignoring case, so "hyper-g" collides with "Hyper-G". Seeded with Ben's ten.
  - `setup`:
    - Racquet, `strung_on` (a real `YYYY-MM-DD` date), `tension_unit` (`lb` or `kg`), who created it and when.
    - Mains and crosses each have a string, gauge and tension, all required. There's no full bed/hybrid column: a setup is a full bed when its mains and crosses have the same string and gauge.
    - Numbers are exact integers. Gauge is in hundredths of a mm (1.00–1.50 mm, stored 100–150). Tension is in tenths of the setup's unit, as typed (30–80 lb or 13.6–36.3 kg, stored 300–800 or 136–363).
    - The database generates each tension in tenths of a kg (`*_tension_tenths_kg`; 1 lb = 0.45359237 kg, rounded half up).
    - A duplicate is refused by one unique index on racquet, date, and the mains' and crosses' strings, gauges and kg tensions.
  - `review`: setup and reviewer (unique together), power, control, comfort, spin and feel (required integers 1–10), optional written review (not blank when given), created and updated times.
  - Strings, racquets, setups and reviewers in use can't be deleted (RESTRICT foreign keys).
- **Setups, reviews and strings: data and Server Actions.**
  - Readers:
    - `getRacquetSetups(slug)`: cached; newest strung first, each setup with its strings, its reviews by reviewer id, and `fullBed` worked out from the strings and gauges.
    - `getSetup(id)`: not cached, for request time.
    - `getStrings()` and `getStringsWithUsage()`: cached; by brand then name, ignoring capitals.
    - `getReviewers()`: cached, by id; the grid's columns. It has no tag because nothing in the app changes a reviewer.
  - Constants: `CRITERIA` (rule 4 order) and `STRING_TYPES` (rule 14 labels). `units.ts` converts and formats tensions ("55 lb" · "24.9 kg"; the converted side always has 1 dp) and gauges ("1.30 mm"), and exports the limits forms use. Its lb → kg matches the database's generated kg for every accepted tension (tested against a real database).
  - Actions:
    - `createSetupWithReview` (`src/reviews/actions.ts`) writes any new strings, the setup and the review in one write transaction. If anything fails, nothing is left behind. A full bed takes the mains' string and gauge for the crosses; the same new string on both sides is added once. A duplicate (compared in kg, as the unique index does) goes to the existing setup's review page with `?existing=1`. Other refusals go back to the form as `?error=invalid|unit|tension|gauge|date|scores|string-exists`.
    - `addReview` adds one review per reviewer per setup. A second attempt goes back to the review page.
    - `updateReview` changes the scores and written review of the logged-in reviewer's own review of a setup, checked like `addReview`. It updates the row for that setup and the reviewer from the session (the form carries only the setup id, never a review or reviewer id), so it can't touch anyone else's review, and with no review of your own it creates nothing: it goes back to the review page, which shows the add form. It sets the review's updated time. A success goes to the setup's card; a refusal to `?error=invalid|scores` on the review page.
    - `deleteReview` (`src/reviews/actions.ts`) deletes the logged-in reviewer's own review of a setup, and the setup too when that was its last review, in one write transaction. It deletes the row for that setup and the reviewer from the session (the form carries only the setup id, never a review or reviewer id), so it can't touch anyone else's review. A success goes to the setup's card, or to the racquet's page when the setup was removed; with no review of your own it deletes nothing and goes back to the review page. A setup that's already gone counts as done (to `/racquets`).
    - `updateString` and `deleteString` (`src/strings/actions.ts`): an edit can't take another string's brand and name, whatever the capitals. A string in use can't be deleted; deleting one that's already gone counts as done.
    - Visitors are sent to `/login?next=<the form page>`.
  - Checks: a real date that isn't after today anywhere on Earth (UTC+14); whole-number scores 1–10; tensions and gauges to the rule's range and decimals ("55.50" is fine, "55.25" isn't); trimmed, non-blank brand and name up to 100 characters; a written review up to 4000 characters (CRLF counts as one, as the browser's `maxLength` does), blank means none.
  - Refresh tags:
    - `setups:<slug>`: that racquet's setups. Refreshed by a new setup, a new review, a review edit or a review delete.
    - `setups`: every racquet's setups. Refreshed by a string edit, because the cards show string names.
    - `strings`: the string list and which strings are in use. Refreshed by any string change, by every new setup and by a review delete that removes its setup (its strings may no longer be in use).
- Not built yet (Ben hasn't decided them): editing setups, public `/strings` or `/setups/[id]` pages, and a list of a reviewer's own reviews on `/account`.
- No CI, not deployed.

## Other decisions by Ben

- **Hosting is postponed on purpose.** Ben is on limited Wi-Fi. (Which host is still open.) The site is paused as it is (Ben is happy with how it works) until he's back from holiday, when he'll sort out hosting.
- **The repo is private.**
- **The site is called "LX Tennis".** Ben renamed it from "LX Tennis Setups" to leave room for more than setups (a "what racquet is right for you" quiz, say). Write it exactly "LX Tennis" in text: page and tab titles, metadata, alt text, docs and messages. On the site itself, headings and the header brand may display it in all caps through CSS (`text-transform: uppercase`), as they do now. Ben likes that look. Racquet and string setups are still what the site mostly is, so descriptions can keep talking about setups; only the name changed. The repo, folder and package are still named `tennis-setups-website` (whether to rename them is open).
- **Photo copyright is not an issue.** The manufacturers' official racquet photos stay, hosted or not: the site is only for a few people. Ben's call.

## Open questions (Ben hasn't answered; don't decide these)

- **More reviewer accounts.** How accounts beyond the first three (Ben, Michal, Otavio) get added.
- **Hosting provider.** Probably Vercel, not final. This also settles where the database lives (see Stack and code).
- **Repo name.** Keep `tennis-setups-website` or rename it (which would also mean the local folder, git remote URL and `package.json` name).
- **Account page extras.** Whether the account page also gets a change-password form and/or a list of the reviewer's own reviews.

## Proposals awaiting Ben (not decided)

- **URL layout.** `/strings`, `/strings/[slug]`, and maybe `/setups/[id]`, alongside the existing `/racquets` and `/racquets/[slug]`. *Why:* leaves room for strings and shareable setups.

## Priority and roadmap order (Ben's decision)

1. **LX Tennis website** (this repo): Ben's #1 project.
2. **Ben's portfolio site**: will showcase this site.
3. **tennis-club-app** and **tennis-game** come after those two.

Within this site, the reviews in the core flow aren't built yet, and most of the open questions shape them.

## How to change this doc

- **When Ben decides something, update this doc in the same change as the code, or on its own if there's no code change.** Move the item out of Open questions or Proposals into the section it belongs to (a product rule into Product rules, and so on), or into Other decisions by Ben if nothing fits. Delete it from where it was, so every fact lives in exactly one place.
- **Proposals only become decisions when Ben says so.** Anyone can add a new open question or proposal, clearly labelled.
- **Team conventions change through team review**, in the same change as the code that follows the new convention.
- **Keep Current state true.** When something ships, update it in the same change.
- **Keep it short and plain.** Rules and reasons, not issue lists or task backlogs.
