# blocked-run

When auto mode blocks a command, you run it yourself with one click.

```
/plugin install blocked-run@spardutti-mods
```

## Why

Auto mode sometimes blocks a command you actually want, like merging a PR or a deploy.
Claude then asks you to copy the command and run it yourself, and tell it what happened.
That's three chores for one click's worth of work.

## How it works

1. **Auto mode blocks a Bash command.** A popup shows, and a line appears above the prompt:

   ```
    AUTO MODE BLOCKED  gh pr merge 50 --squash
   [ Run it myself ] [ Dismiss ]
   ```

2. **You click Run it myself.** The line turns cyan and shows `RUNNING` with the latest line of output.
3. **It finishes.** The line turns green `DONE`, or red `FAILED (exit 1)`, with the last line of output.
4. **You send any message.** Claude gets the command's output with it, and the line goes away.

**Dismiss** hides the line and runs nothing.

## Good to know

- **It runs the exact command shown**, in the session's folder, and only when you click.
- **Long commands are fine.** A deploy that takes minutes keeps running in the background.
- **Claude gets the last 4000 characters** of the output, which is enough for the result without flooding the chat.
- **Why you send a message after it's done:** a mod can't start Claude's turn by itself,
  so the output waits for your next message.
- **Only Bash commands.** A blocked file edit or other tool doesn't show here.

[← All mods](../../README.md)
