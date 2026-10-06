# auto-handoff

Hands your work to a fresh session when the context gets too full.

```
/plugin install auto-handoff@spardutti-mods
```

## Why

Long sessions get slow and forgetful. The fix is a fresh session, but starting one
means writing down where you were, clearing, and explaining it all again. You put it off
until the session is already struggling.

## How it works

1. **A warning.** 5 points before the threshold, a yellow line shows above the prompt:
   `Context at 55%. Handoff starts at 60%.`
2. **A countdown.** At the threshold (60% by default), the line counts down 10 seconds
   with a **Not now** button.
3. **The handoff.** When the countdown ends, it runs your `/handoff` command, which writes
   `.claude/handoffs/<date>-<topic>.md`.
4. **A fresh session.** It clears the chat and names the new session after the handoff,
   so `/resume` lists it.
5. **Carry on.** It tells the fresh session to read the handoff and continue.

## Stopping it

- **Not now** stops the countdown. It asks again when Claude's next reply ends.
- **Sending a message** during the countdown stops it too. Your message wins.

## Good to know

- No `/handoff` command installed? It runs a normal `/compact` instead. Same if the handoff
  skill decides there's nothing worth writing down.
- It only checks when a turn ends, never in the middle of work.
- It skips subagents and interrupted turns.
- The handoff it writes counts as picked up in [handoff-pickup](handoff-pickup.md).

## Settings

**Change the 60%:** open `/plugin`, pick `auto-handoff`, and set **Handoff threshold (%)**.
Any value from 10 to 95 works.

[← All mods](../../README.md)
