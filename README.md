<div align="center">

# claude-mods

**Little panels for Claude Code that keep the stuff you'd normally go check right next to the chat.**

![Claude Code 2.1.287+](https://img.shields.io/badge/Claude%20Code-2.1.287%2B-d97757)
![mods: 1](https://img.shields.io/badge/mods-1-8aadf4)

<img src="docs/branch-status.svg" alt="The branch-status panel: main, develop with 3 merges to release, and feat/login with 2 commits" width="600">

</div>

## Why

I work with git flow all day: features go into `develop`, `develop` goes into `main` on release.
And I kept asking the same three questions. What's waiting to ship? Is my branch behind?
Did that release actually land? Each one meant leaving the chat to run `git log`.

So I made Claude Code show me. These mods are plugins that draw live panels inside your session.
Each one installs on its own, so you take only what you want.

## Get started

Add the marketplace once, then install a mod:

```
/plugin marketplace add spardutti/claude-mods
/plugin install branch-status@spardutti-mods
```

That's it. The panel opens on the next session start, or right away with `/branch-status`.

## The mods

### branch-status

Your branch, `develop` and `main`, drawn as a tiny git-flow graph.

| You see | It means |
| --- | --- |
| **3 to release** next to `develop` | Three merges on `develop` that `main` doesn't have yet. They're listed below the graph. |
| **2 commits** next to your branch | What your branch adds on top of `develop`. |
| **← you** | The branch you're on. |
| A **red line** | Something's behind. Pull, or merge `main` back into `develop`. |
| **all released** | `develop` and `main` match. Nothing waiting. |

A few things it gets right so you don't have to think about them:

- **Merge commits that carry no code are ignored.** After a release, `main` doesn't look "1 ahead" just because of the merge itself.
- **Other branches come from `origin`.** A stale local `main` won't fool it. It's as fresh as your last `git fetch` or `git pull`.
- **Nothing gets cut off.** Long branch and PR names wrap instead.
- **It keeps itself up to date.** It refreshes on start, after any `git` or `gh` command, and every 30 seconds.

`main` and `develop` are fixed names for now.

## Put the panel beside the chat

Out of the box, the panel sits above the chat. Switch Claude Code to fullscreen view and it
docks on the right, which is how it's meant to be used:

```
/tui fullscreen
```

It's saved for every new session. Fullscreen needs a terminal at least 110 columns wide.
Changed your mind? `/tui default` takes you back.

<details>

<summary><b>Fullscreen troubleshooting</b></summary>

- **Scrolling feels slow.** Run `/scroll-speed` and pick a bigger number.
- **Old text stays on screen (Windows Terminal, WSL).** Start Claude with
  `CLAUDE_CODE_ALT_SCREEN_FULL_REPAINT=1 claude`.
- **A session you already had open didn't change.** Open sessions keep their view.
  Run `/tui fullscreen` in each one.
- **Using herdr and the panel won't dock.** Update herdr to 0.9.3 or newer, then run
  `herdr integration install claude`.

</details>

<details>

<summary><b>Updating</b></summary>

```
/plugin marketplace update spardutti-mods
/plugin update branch-status@spardutti-mods
/reload-plugins
```

</details>

## Make your own

Each mod is a folder in `plugins/` plus one line in `.claude-plugin/marketplace.json`.
In Claude Code, ask for the `plugin-authoring` skill and describe the panel you want.
Before you push, run the checks:

```
claude plugin validate plugins/<mod>
claude plugin test plugins/<mod>
claude plugin validate .
```

Got an idea for a mod, or found a bug? [Open an issue](https://github.com/Spardutti/claude-mods/issues).
