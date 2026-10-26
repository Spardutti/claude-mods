# handoff-pickup

Picks up a handoff you left behind with one command.

```
/plugin install handoff-pickup@spardutti-mods
```

## Why

You write a handoff on Friday and close up. On Monday, one command gets you back into it.

## How it works

1. Run `/pickup`, then send any message. Claude reads the newest handoff and carries on.
2. When the work is done, run `/pickup done`. The handoff file is deleted.

## Good to know

- **Why you send a message after `/pickup`:** a command can't start Claude's turn by itself,
  so the note waits for your next message.
- **A picked-up handoff is skipped next time**, even after a reload or in another session.
- **Handoffs that [auto-handoff](auto-handoff.md) resumes count as picked up**, so `/pickup done` cleans those up too.

## Settings

**Keep handoffs somewhere else?** Open `/plugin`, pick `handoff-pickup`, and set **Handoff folder**.
It defaults to `.claude/handoffs`.

[← All mods](../../README.md)
