# Plan — auto-handoff mod

## Goal

When a session's context passes 60% full, hand the work to a fresh session by itself:
write a handoff, clear, name the new session, and resume from the handoff.
Without the `handoff` command installed, run a normal compact instead.

## Setting

| Setting | Type | Default | Meaning |
| --- | --- | --- | --- |
| `threshold` | number, 10–95 | `60` | Percent of the context window that starts a handoff. |

Read from `options` in `register`, declared under `userConfig` in `plugin.json`.

## Flow

1. **A turn ends** (`turn.complete`). Skip it if any of these hold:
   - a subagent ran it (`agentId` set)
   - it was interrupted or errored (`reason` is not `answer`)
   - a handoff is already running
2. **Check the fill.** `$.session.usage()` gives `context.percent` with no extra request.
   Below the threshold: do nothing.
3. **Tell the person.** Toast: `Context at 61%. Handing off to a fresh session.`
4. **Handoff installed?** Look for `handoff` in `$.command.list()`.
   - **Yes:** run `$.command.run({ command: 'handoff' })`. The model writes the file.
   - **No:** run `$.session.compact()` and stop.
5. **Find the file.** On the next `turn.complete`, read `Handoff written: <path>` from `answer`.
   If it is missing, compact instead (step 4, No).
6. **Name it.** The file's first line is `# Handoff — <subject>`. That subject is the name.
7. **Start fresh.** In order:
   1. `$.command.run({ command: 'clear' })`
   2. `$.command.run({ command: 'rename', args: subject })`
   3. `$.prompt.submit({ text: 'Read <path> and continue.', asUser: true })`

## Spike results (2026-10-04, real session in project-x)

1. **Built-in commands work** from `$.command.run`: `rename` and `clear` both ran.
   They must run from a later event like `turn.complete`. From inside a `command.run`
   hook the engine refuses, since it would wait on its own turn.
2. **The mod keeps running across `/clear`.** `$.store` kept its value, `turn.complete`
   kept firing, and `session.start` did not fire again.
   `clear` then `rename` names the new session (its saved `customTitle`), so `/resume` lists it.
3. **`$.command.run({ command: 'handoff' })` returns at once.** The model writes the handoff in
   the next turn, and that turn's `turn.complete` carries the full `answer`.
4. **The handoff skill can refuse** (it did, on an empty session). So a missing
   `Handoff written:` line falls back to compact.
5. **`$.prompt.submit({ asUser: true })` after `clear` resumes** in the fresh session.
   Run the calls unawaited (`void`) from `turn.complete`, so the hook does not hold the turn.

## Files

- `plugins/auto-handoff/.claude-plugin/plugin.json`: manifest and the `threshold` setting
- `plugins/auto-handoff/hooks/hooks.json`
- `plugins/auto-handoff/hooks/register.ts`: the hooks
- `plugins/auto-handoff/hooks/handoff.ts`: pure parsing, the path from the answer and the subject from the file
- `plugins/auto-handoff/hooks/*.test.ts`
- `.claude-plugin/marketplace.json`: one new entry
- `README.md`: one new section, mods badge to 2

## Steps

1. ~~Spike~~ done, see results above.
2. Pure parsing in `handoff.ts` with tests.
   → verify: path and subject parse; junk input returns nothing.
3. Hooks in `register.ts` with tests using a mocked `usage`, `command.list` and `command.run`.
   → verify: below threshold does nothing; above with handoff runs the full flow;
   without handoff compacts; subagent and aborted turns are skipped; fires once.
4. Marketplace entry, README section.
   → verify: `claude plugin validate .`, `claude plugin test plugins/auto-handoff`, strict `tsc`.
5. Real run: set `threshold` to 5 in a scratch project and watch it hand off.

## Not doing

- Cache warming while idle. Each ping re-reads the whole context and burns usage limits.
- A token-count threshold. Percent works on every model size.
