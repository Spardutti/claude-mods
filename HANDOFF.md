# Handoff — 2026-10-04

## Where things are

- `branch-status` is built, moved here from a dev session, and renamed from `git-graph`.
- Checks pass: `claude plugin validate`, `claude plugin test` (3 tests), and a strict `tsc`.
- Nobody has seen it on a real screen yet.
- Local repo only. No GitHub repo, nothing pushed.

## What it does

- Panel shows: branch name, ↑ahead / ↓behind `main`, and the first-parent commits on
  `develop` not on `main` (one line per merged feature).
- Refreshes on session start, after any Bash call running `git` or `gh`, and every 30 s.
- `main` and `develop` are hard-coded in `hooks/register.tsx`.

## Next

1. Install it in a project that has a `develop` branch:
   `/plugin marketplace add /home/spardutti/projects/personal/claude-mods`, then
   `/plugin install branch-status@spardutti-mods`.
2. Look at it: fullscreen terminal, 110+ columns docks it beside the chat; otherwise it sits
   above the prompt.
3. Fix what looks wrong, then decide on a GitHub repo and push.

## Open questions

- Should the branch names be settings (`userConfig`) instead of fixed?
- Is the panel the right place, or would one line above the prompt be enough?
