# LX Tennis

Racquet and string setups (frame, string, gauge, tension) tested by me and my friends, with each person's own scores and reviews shown side by side.

**Read [`docs/vision.md`](docs/vision.md) first.** It's the single source of truth for what we're building: the product and theme rules, the stack conventions, what's decided, and what's still open.

## Stack

- [Next.js](https://nextjs.org) (App Router) + TypeScript, with Cache Components (Partial Prerendering) on
- Plain CSS / CSS Modules; the synthwave theme lives as design tokens (CSS custom properties) in `src/app/globals.css`
- SQLite through [Drizzle ORM](https://orm.drizzle.team) and `@libsql/client`: a local file in development, [Turso](https://turso.tech) (hosted SQLite) later by changing `DATABASE_URL`
- Racquets (with their specs) and reviewer accounts in the database, read through `src/data/racquets.ts` and `src/data/reviewers.ts`
- Racquet photos: the four built-in ones in `public/images/racquets/`; the photo of a racquet a reviewer adds is converted by [sharp](https://sharp.pixelplumbing.com) to 1000 × 1500 WebP and stored in [Vercel Blob](https://vercel.com/docs/vercel-blob)

## Setup

Requires Node.js 20.9 or newer to run the site. `npm test` needs Node.js 25.9 or newer (see Gotchas).

1. **Install:**

   ```bash
   npm install
   ```

2. **Environment:** copy the example and fill in `SESSION_SECRET` (the comments in the file say how to generate one). `.env.local` is gitignored; never commit it.

   ```bash
   cp .env.example .env.local
   ```

   | Variable | What it is |
   | --- | --- |
   | `DATABASE_URL` | `file:local.db` for a local SQLite file in the repo root (gitignored), or a `libsql://…turso.io` URL for Turso |
   | `DATABASE_AUTH_TOKEN` | Turso only; empty for a local file |
   | `BLOB_READ_WRITE_TOKEN` | Vercel Blob read-write token, where the photos of added racquets are stored. Create a **public** Blob store in the Vercel project (Storage tab) and connect it to the project; Vercel adds the token to the project's environment itself. Not needed in `npm run dev`: with no token, a photo is written to `public/images/racquets/uploads/` (gitignored). Only `npm run dev` has that fallback: a production server, including a local `npm run start`, refuses to add a racquet without a token. A real token in `.env.local` makes local uploads go to the production Blob store |
   | `SESSION_SECRET` | At least 32 random characters; signs the login cookie and hashes the failed-login counters' keys. Changing it logs everyone out and forgets recent failed attempts |

3. **Create the database:** applies the migrations in `drizzle/`, which create the `reviewer`, `racquet`, `string`, `setup`, `review` and `login_attempt` tables, add Ben, Michal and Otavio (usernames `ben`, `michal`, `otavio`) with no password, and add the four racquets (with their specs, photos and source pages) and Ben's ten starting strings. Run it again after pulling new migrations; it only applies the ones that are missing.

   ```bash
   npm run db:migrate
   ```

4. **Set each reviewer's password:** it asks twice and doesn't echo what you type, so the password never lands in your shell history. Run it again any time to reset a password; that also logs the reviewer out on every device.

   ```bash
   npm run db:set-password -- ben
   npm run db:set-password -- michal
   npm run db:set-password -- otavio
   ```

5. **Run it:** `npm run dev`, then open http://localhost:3000 and use **Log in** in the header.

## Scripts

```bash
npm run dev              # dev server at http://localhost:3000
npm run build            # production build (lists which routes are static / partially prerendered)
npm run start            # serve the production build
npm run lint             # ESLint
npm test                 # unit tests (node:test via tsx): password hashing, session cookie, login redirect, login by email, the failed-attempt limiter (lockouts, per-address keys, concurrency), database rules, setup/review (add, edit-own and delete-own)/string forms and actions (on throwaway databases, never local.db)
npm run db:migrate       # apply pending migrations in drizzle/ to DATABASE_URL
npm run db:generate      # after editing src/db/schema.ts: write the SQL migration into drizzle/
npm run db:set-password -- <username>   # set or reset a reviewer's password
```

## Gotchas

- **`PageProps` / `LayoutProps` are generated types.** Next creates them in `.next/` (gitignored), so on a fresh clone your editor and `tsc` will report them as missing until you run `npm run dev`, `npm run build` or `npx next typegen` once.
- **`next dev` rewrites part of `AGENTS.md`.** When it detects an AI coding agent and the Next.js block is missing or out of date, it rewrites everything between the `<!-- BEGIN:nextjs-agent-rules -->` and `<!-- END:nextjs-agent-rules -->` markers (see `node_modules/next/dist/server/lib/generate-agent-files.js`). Don't edit inside those markers; put project notes outside them, where they survive.
- **The build needs internet and the database.** `next/font` downloads the Geist and Orbitron fonts from Google Fonts at build time, and each racquet page is prerendered with its setup cards read from the database. So `DATABASE_URL` must point at a database with every migration applied.
- **Migrations are the schema's history.** Commit the generated files in `drizzle/` together with the `src/db/schema.ts` change, and never edit a migration that has already been applied somewhere; add a new one.
- **`npm test` and `db:set-password` run `tsx --conditions=react-server`.** Server-side modules import `server-only`, which throws when loaded outside the React server environment; that flag tells Node to load the server build of it. Don't remove it from `package.json`, or every test and the password script will fail on import.
- **`npm test` needs Node.js 25.9 or newer.** It passes `--experimental-test-module-mocks` so the database tests can stand in for `next/cache` (see `src/data/test-database.ts`). Node prints an `ExperimentalWarning` for each of those files; that's expected.
