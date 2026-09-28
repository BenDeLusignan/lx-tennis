# Tennis Setups Website

Racquet and string setups (frame, string, gauge, tension) tested by me and my friends, with each person's own scores and reviews shown side by side.

The site currently has a landing page listing the racquets and a detail page per racquet with its official Yonex specs and a (still empty) reviews section.

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
