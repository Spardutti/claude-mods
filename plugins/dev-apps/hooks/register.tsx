import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Project } from '../types'
import { LISTENING, READ_REGISTRY, checkIn, checkOut, startCommands, stopCommand } from './commands'
import { COMPOSE_FILES, launcherFor } from './launch'
import { drawApps, splitPane } from './panel'
import type { PaneInput } from './panel'
import { projectName } from './project'
import { browserApps } from './registry'
import { listeningPorts } from './running'

const GIT_PANE = 'branch-status'
const PANE = 'dev-apps'
const POLL_MS = 3_000
const project = atom({ plugin: 'dev-apps', key: 'project' } as const, null as Project | null)

async function output($: EngineInterface, argv: string[], cwd?: string) {
  const { exitCode, stdout } = await $.process.run(argv, { cwd }).catch(() => ({ exitCode: 1, stdout: '' }))
  return exitCode === 0 ? stdout : undefined
}

const readFile = ($: EngineInterface, path: string) => $.fs.read(path).catch(() => undefined)

async function load($: EngineInterface, cwd: string): Promise<Project | null> {
  const commonDir = await output($, ['git', 'rev-parse', '--path-format=absolute', '--git-common-dir'], cwd)
  const root = (await output($, ['git', 'rev-parse', '--show-toplevel'], cwd))?.trim() || cwd
  const name = projectName(commonDir, cwd)
  const apps = browserApps((await output($, READ_REGISTRY)) ?? '', name)
  if (!apps.length) return null
  const files = (await $.fs.list(root).catch(() => [])).map(entry => entry.name)
  const composeFile = COMPOSE_FILES.find(file => files.includes(file))
  const sources = {
    compose: composeFile ? await readFile($, `${root}/${composeFile}`) : undefined,
    env: await readFile($, `${root}/.env`),
    pkg: files.includes('package.json') ? await readFile($, `${root}/package.json`) : undefined,
    files,
  }
  const launcher = launcherFor(sources, apps.map(app => app.port))
  return { name, root, apps, launcher, listening: [] }
}

async function poll($: EngineInterface) {
  const shown = await read($, project)
  if (!shown) return
  void $.process.run(checkIn(shown.name, await $.session.id())).catch(() => undefined)
  const listening = listeningPorts((await output($, LISTENING)) ?? '')
  const isAllUp = shown.apps.every(app => listening.includes(app.port))
  await update($, project, now => now && { ...now, listening, startedAt: isAllUp ? undefined : now.startedAt })
}

async function start($: EngineInterface) {
  const shown = await read($, project)
  if (!shown?.launcher) return
  const startedAt = await $.clock.now()
  await update($, project, now => now && { ...now, startedAt })
  for (const argv of startCommands(shown.name, shown.launcher)) await $.process.run(argv, { cwd: shown.root })
}

async function stop($: EngineInterface) {
  const shown = await read($, project)
  if (!shown?.launcher) return
  await update($, project, now => now && { ...now, startedAt: undefined })
  await $.process.run(stopCommand(shown.name, shown.launcher), { cwd: shown.root })
}

async function stopIfLast($: EngineInterface) {
  const shown = await read($, project)
  if (!shown?.launcher) return
  const left = await output($, checkOut(shown.name, await $.session.id()))
  if (left?.trim() === 'last') await $.process.run(stopCommand(shown.name, shown.launcher), { cwd: shown.root })
}

async function apps($: EngineInterface, e: PaneInput) {
  const shown = await read($, project)
  if (!shown) return undefined
  const actions = { start: () => void start($), stop: () => void stop($) }
  return drawApps($, e, shown, await $.clock.now(), actions)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'apps', description: "Open, start and stop this project's browser apps" })
    void load($, e.cwd).then(async found => {
      await update($, project, () => found)
      await poll($)
    })
    $.clock.every(POLL_MS, () => void poll($))

    return next(e)
  })

  on('command.run', { command: 'apps' }, async $ => {
    const shown = await read($, project)
    if (!shown) return { text: 'No browser apps for this project in dev-ports.' }
    await $.ui.open({ id: PANE, title: 'Apps' })

    return { text: 'Apps panel opened.' }
  })

  // A /clear or a resume keeps Claude running, so the apps stay up.
  on('session.end', async ($, e, next) => {
    if (e.reason !== 'clear' && e.reason !== 'resume') await stopIfLast($)

    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: GIT_PANE }, async ($, e, next) => {
    const git = await next(e)
    const drawn = await apps($, e)

    return drawn ? splitPane($, e, git, drawn) : git
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Text } = $.ui.resolve(e)

    return (await apps($, e)) ?? <Text dimColor>No browser apps for this project in dev-ports.</Text>
  })
}
