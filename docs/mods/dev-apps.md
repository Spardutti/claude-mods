# dev-apps

See which of this project's apps are running, open them, and start or stop them, right under the Git panel.

```
/plugin install dev-apps@spardutti-mods
```

## Why

With five projects open, each in its own terminal, you lose track of which app runs on which port.
You end up hunting through terminals to find the URL, or to stop a stack you forgot about.

## How it works

1. **It reads your `dev-ports` registry** and finds this project's browser apps:
   `web`, `backoffice`, `admin`, and anything starting with `storybook` or `docs`. APIs and databases stay hidden.
2. **It draws them in the bottom half of the Git panel** ([branch-status](branch-status.md)):

   ```
   Apps shadowsource
   web running
     http://localhost:5185
   Containers
   web running
   db running
   api crashed, code 1
   [ Start ] [ Stop ]
   ```

   For a compose project it lists every container, the database too: `running`, `starting`, `unhealthy`,
   `restarting`, `crashed, code N`, `exited` or `stopped`.

3. **Click the address** to open the app in your browser.
4. **Start** runs `docker compose watch` when the compose file has a `develop: watch:` section, else `docker compose up -d`.
   With no compose file, it runs your dev script (`npm`, `pnpm`, `bun` or `yarn`, picked from the lock file).
   **Stop** ends the watch and runs `docker compose down`, or stops the dev script.
5. **When you close the last Claude session for the project**, it stops everything that project runs.

## Good to know

- **It finds the start command by port.** A compose file that maps the app's port wins, with `.env` values filled in.
  Otherwise it uses a `package.json` script that names the port. If nothing names it, you get the link only.
- **Stop stops the whole project,** database included, the same as `docker compose down`.
- **Two sessions on one project:** closing one leaves the apps up. Only the last one to close stops them.
- **`/clear` and `/resume` don't stop anything.** Claude is still running.
- **A start that isn't up after 90 seconds shows as failed.** Its output is in `~/.cache/dev-apps/<project>/`.
- **Start shows when anything is down or crashed. Stop shows when anything is up,** the database included.
  So a crashed container gets Start, and a database left up by a failed start gets Stop.
- **Exit codes 130, 137 and 143 count as stopped,** not crashed: Ctrl-C, a kill and `docker compose stop` leave them.
- **Stop shows `stopping`** until the apps and containers are down, and the buttons hide meanwhile.
- **No Git panel?** `/apps` opens the apps in their own panel.
- **Worktrees count as their main project,** so they find the same rows in `dev-ports`.

[← All mods](../../README.md)
