# claude-mods

Mods for Claude Code: small plugins that draw live panels inside your session.
Each mod installs on its own. Needs Claude Code 2.1.287 or newer.

## Install

Add the marketplace once:

```
/plugin marketplace add spardutti/claude-mods
```

Then install the mods you want:

```
/plugin install branch-status@spardutti-mods
```

From a local clone, pass the folder path to `marketplace add` instead.

## Update

```
/plugin marketplace update spardutti-mods
/plugin update branch-status@spardutti-mods
/reload-plugins
```

## Mods

### branch-status

A small git-flow graph of `main`, `develop` and your branch.

```
main        ●──────────
             ╲
develop       ●─●─●      3 to release
                   ╲
feat/login          ●─●  2 commits  ← you
                    develop has 4 new, pull it

  · #72  chore/back-merge-v0.7.0
```

- **develop** shows the merges that `main` does not have yet, listed below the graph.
- **Your branch** shows its own commits, counted against `develop`.
- **Red lines** flag a branch that is behind and needs a pull or a back-merge.
- Merge commits that carry no code are ignored, so a release or a sync does not show as "ahead".
- Other branches are read from `origin`, so run `git fetch` or `git pull` to keep them fresh.
- It refreshes on start, after any `git` or `gh` command, and every 30 seconds.
- `/branch-status` reopens the panel.

The branch names `main` and `develop` are fixed for now.

## Fullscreen: panel beside the chat

In the normal terminal view, the panel sits above the chat. In fullscreen view, it docks on
the right side. Fullscreen needs a terminal at least 110 columns wide.

Turn it on from any session (it is saved for every session after):

```
/tui fullscreen
```

Turn it off:

```
/tui default
```

Tips:

- **Slow scrolling:** run `/scroll-speed` and pick a higher number.
- **Old text left on screen (Windows Terminal, WSL):** start Claude with
  `CLAUDE_CODE_ALT_SCREEN_FULL_REPAINT=1 claude`.
- **Sessions already open** keep their old view. Run `/tui fullscreen` in each one.
- **herdr:** update to 0.9.3 or newer and run `herdr integration install claude`.
  Older versions keep the panel above the chat.

## Make a mod

Each mod lives in `plugins/<mod>/` and is listed in `.claude-plugin/marketplace.json`.
Check a mod before you push:

```
claude plugin validate plugins/<mod>
claude plugin test plugins/<mod>
claude plugin validate .
```
