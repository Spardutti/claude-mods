<div align="center">

# claude-mods

**Little mods for Claude Code: panels that keep the stuff you'd normally go check next to the chat, and helpers that do the chores for you.**

![Claude Code 2.1.287+](https://img.shields.io/badge/Claude%20Code-2.1.287%2B-d97757)
![mods: 4](https://img.shields.io/badge/mods-4-8aadf4)
![License: MIT](https://img.shields.io/badge/license-MIT-a6da95)

</div>

## Why

You spend all day in Claude Code. But the small stuff keeps pulling you out of it:
checking git, rescuing a session that got too long, doing the same cleanup by hand.

These mods put that stuff inside Claude Code. Some draw a live panel next to the chat.
Some do a chore for you at the right moment. You keep your eyes on the work.

Each one installs on its own, so you take only what you want.

## Get started

Add the marketplace once, then install a mod:

```
/plugin marketplace add spardutti/claude-mods
/plugin install branch-status@spardutti-mods
/plugin install auto-handoff@spardutti-mods
/plugin install handoff-pickup@spardutti-mods
/plugin install blocked-run@spardutti-mods
```

Install any you like. Each one starts working on the next session start.

## The mods

Each mod has its own page with the full story.

| Mod | What it does |
| --- | --- |
| [branch-status](docs/mods/branch-status.md) | A panel with your branch, `develop` and `main` as a tiny git-flow graph, so you see what's waiting to ship without running `git log`. |
| [auto-handoff](docs/mods/auto-handoff.md) | When the context gets too full, it warns you, counts down, then hands the work to a fresh session. |
| [handoff-pickup](docs/mods/handoff-pickup.md) | Reminds you of a handoff you left behind. `/pickup` picks it up, `/pickup done` deletes it. |
| [blocked-run](docs/mods/blocked-run.md) | When auto mode blocks a command, it shows above the prompt with a button to run it yourself. |

<details>

<summary><b>Updating</b></summary>

```
/plugin marketplace update spardutti-mods
/plugin update branch-status@spardutti-mods
/plugin update auto-handoff@spardutti-mods
/plugin update handoff-pickup@spardutti-mods
/plugin update blocked-run@spardutti-mods
/reload-plugins
```

</details>
