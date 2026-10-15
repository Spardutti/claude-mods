import type { Launcher } from '../types'

// Every script takes the project as $1; its files live in this folder.
const CACHE = '"$HOME/.cache/dev-apps/$1"'

export const LOG_FOLDER = '~/.cache/dev-apps'

export const READ_REGISTRY = ['sh', '-c', 'cat "${DEV_PORTS_REGISTRY:-$HOME/.config/dev-ports/registry.tsv}"']

export const LISTENING = ['ss', '-ltnH']

// setsid -f lets the app outlive Claude; the exec line frees the pipes so the call returns at once.
const detached = (script: string, ...args: string[]) => ['setsid', '-f', 'sh', '-c', `mkdir -p ${CACHE} && ${script}`, 'sh', ...args]

const compose = (verb: string) => `exec >> ${CACHE}/docker.log 2>&1 < /dev/null && exec docker compose ${verb}`

const npmRun = `exec > ${CACHE}/"$2".log 2>&1 < /dev/null && echo $$ > ${CACHE}/"$2".pid && exec "$3" run "$2"`

const KILL_STARTED = `for f in ${CACHE}/*.pid; do [ -f "$f" ] && kill -TERM "-$(cat "$f")" 2>/dev/null; rm -f "$f"; done`

export function startCommands(project: string, launcher: Launcher): string[][] {
  if (launcher.kind === 'docker') return [detached(compose('up -d'), project)]
  return launcher.scripts.map(script => detached(npmRun, project, script, launcher.manager))
}

export function stopCommand(project: string, launcher: Launcher): string[] {
  if (launcher.kind === 'docker') return detached(compose('down'), project)
  return ['sh', '-c', KILL_STARTED, 'sh', project]
}

export const checkIn = (project: string, session: string) =>
  ['sh', '-c', `mkdir -p ${CACHE}/sessions && touch ${CACHE}/sessions/"$2"`, 'sh', project, session]

// Prints "last" when no other session checked in for this project in the last 2 minutes.
export const checkOut = (project: string, session: string) =>
  ['sh', '-c', `rm -f ${CACHE}/sessions/"$2"; find ${CACHE}/sessions -type f -mmin -2 | grep -q . || echo last`, 'sh', project, session]
