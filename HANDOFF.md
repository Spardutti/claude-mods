# Handoff — 2026-10-04

## Where things are

- `branch-status` 0.2.3 is live on a real screen and looks right.
- Repo is public on GitHub: `Spardutti/claude-mods`.
- Checks pass: `claude plugin validate`, `claude plugin test` (7 tests), strict `tsc`.

## What changed this session

- The panel is now a small git-flow graph (`hooks/graph.ts`), not lines of text.
- Other branches are read from `origin`; local copies went stale and showed false drift.
- Merge commits with no code are ignored, so release and sync merges stop showing as ahead.
- The panel asks for 56 columns when docked; long names wrap, never cut.

## Learned

- The panel docks beside the chat only in fullscreen (`/tui fullscreen`) at 110+ columns.
- herdr 0.8.2 kept it above the chat; 0.9.3 plus `herdr integration install claude` docks it.

## Open questions

- Should `main` and `develop` be settings (`userConfig`) instead of fixed?
- Should the mod run `git fetch` itself, so `origin` is never stale?
