# claude-mods

Claude Code mods (function-hook plugins). Needs Claude Code 2.1.287 or newer.

## Install

```
/plugin marketplace add spardutti/claude-mods
/plugin install branch-status@spardutti-mods
```

From a local clone, pass the folder path to `marketplace add` instead.

## Mods

| Mod | What it shows |
| --- | --- |
| `branch-status` | Your branch, how far it is ahead of and behind `main`, and the merges on `develop` that `main` does not have yet. Opens as a panel; `/branch-status` reopens it. |

## Develop

```
claude plugin validate plugins/<mod>
claude plugin test plugins/<mod>
claude plugin validate .
```
