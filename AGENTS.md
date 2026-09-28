<!--
  Project section. Keep it OUTSIDE the nextjs-agent-rules markers below:
  `next dev` rewrites everything between those markers, but leaves the rest of
  this file alone (node_modules/next/dist/server/lib/generate-agent-files.js).
-->

# Tennis Setups: read the vision first

`docs/vision.md` is the single source of truth for this project: what we're building, for whom, the product and theme rules, the code conventions, and what Ben has and hasn't decided. Every rule in it is labelled either **Ben's decision** or **Team convention**.

1. **Read `docs/vision.md` before you plan, build or review anything here.**
2. **Follow its rules**, both Ben's decisions and team conventions. Items under "Open questions" and "Proposals awaiting Ben" are not decided; don't build on them as if they were, and don't settle them yourself.
3. **Flag conflicts with Ben's decisions to Ben.** If a request conflicts with one, say so and ask Ben. Don't silently deviate, and don't silently change the doc to fit.
4. **Take team conventions to your teammate's review, not to Ben.** If a convention gets in the way, propose the change in review; if it's agreed, change the code and the doc together.
5. **Keep it current.** When Ben decides something, update `docs/vision.md` in the same change as the code, or on its own if there's no code change: move the item out of Open questions/Proposals into the section it belongs to, so each fact lives in one place.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
