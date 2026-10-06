# handoff-pickup

Reminds you of a handoff you left behind, and picks it up for you.

```
/plugin install handoff-pickup@spardutti-mods
```

## Why

You write a handoff on Friday, close up, and on Monday you've forgotten it exists.
The notes are sitting right there, and you start from scratch anyway.

## How it works

When a handoff is waiting, a line shows above the prompt:

```
Handoff waiting: Fix the login redirect (3 days ago) · /pickup
```

1. Run `/pickup`, then send any message. Claude reads the handoff and carries on.
2. When the work is done, run `/pickup done`. The handoff file is deleted and the line goes away.

## Good to know

- **Why you send a message after `/pickup`:** a command can't start Claude's turn by itself,
  so the note waits for your next message.
- **It checks every 5 minutes**, so a session you left open over the weekend shows it too.
- **A handoff less than an hour old stays quiet**, because you're most likely working from it.
- **A picked-up handoff stays hidden**, even after a reload or in another session.
- **Handoffs that [auto-handoff](auto-handoff.md) resumes count as picked up**, so `/pickup done` cleans those up too.
- **More than one waiting?** It shows the newest, with "(+2 more)" after it.

## Settings

**Keep handoffs somewhere else?** Open `/plugin`, pick `handoff-pickup`, and set **Handoff folder**.
It defaults to `.claude/handoffs`.

[← All mods](../../README.md)
