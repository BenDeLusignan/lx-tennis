# Tennis Setups Website

Racquet and string setups (frame, string, gauge, tension) tested by me and my friends, with each person's own scores and reviews shown side by side.

**Read [`docs/vision.md`](docs/vision.md) first.** It's the single source of truth for what we're building: the product and theme rules, the stack conventions, what's decided, and what's still open.

## Stack

- [Next.js](https://nextjs.org) (App Router) + TypeScript
- Plain CSS / CSS Modules; the synthwave theme lives as design tokens (CSS custom properties) in `src/app/globals.css`
- Racquet data in `src/data/racquets.ts` (swap its accessor functions for database queries later; pages don't need to change)
- Racquet photos in `public/racquets/`

## Running it

Requires Node.js 20.9 or newer.

```bash
npm install     # install dependencies
npm run dev     # start the dev server at http://localhost:3000
npm run build   # production build
npm run start   # serve the production build
npm run lint    # ESLint
```

## Gotchas

- **`PageProps` / `LayoutProps` are generated types.** Next creates them in `.next/` (gitignored), so on a fresh clone your editor and `tsc` will report them as missing until you run `npm run dev`, `npm run build` or `npx next typegen` once.
- **`next dev` rewrites part of `AGENTS.md`.** When it detects an AI coding agent and the Next.js block is missing or out of date, it rewrites everything between the `<!-- BEGIN:nextjs-agent-rules -->` and `<!-- END:nextjs-agent-rules -->` markers (see `node_modules/next/dist/server/lib/generate-agent-files.js`). Don't edit inside those markers; put project notes outside them, where they survive.
- **The build needs internet.** `next/font` downloads the Geist and Orbitron fonts from Google Fonts at build time.
