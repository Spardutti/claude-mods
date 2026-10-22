import { mock } from 'claude-code/testing'
import type { RenderElement } from 'claude-code'
import type { TestBody } from 'claude-code/testing'

export type Engine = Parameters<TestBody>[0]
type On = Parameters<TestBody>[1]
export type Machine = { wait: (ms: number) => Promise<void>; listening: number[]; files: Record<string, string>; ran: string[][]; isOtherSessionOpen?: boolean; isGitBelow: boolean; logError?: string }

// The test runtime has timers; the mod's type roots leave them out.
declare function setTimeout(run: () => void, ms: number): unknown

export const ROOT = '/home/me/projects/shop'
const REGISTRY = '4321\tshop\tweb\n4322\tshop\tbackoffice\n4323\tshop\tapi\n'
export const COMPOSE = 'services:\n  web:\n    ports:\n      - "${WEB_PORT}:4321"\n'
const PANE_PROPS = { title: 'Git', isFocused: false, bodyColumns: 50, placement: 'dock', scroll: { offset: 0, bodyRows: 20 }, view: {} } as const

function stdoutFor(argv: readonly string[], cwd: string, machine: Machine) {
  if (argv[0] === 'git') return argv.includes('--git-common-dir') ? `${cwd}/.git\n` : `${cwd}\n`
  if (argv[0] === 'ss') return machine.listening.map(port => `LISTEN 0 511 0.0.0.0:${port} 0.0.0.0:*`).join('\n')
  if (argv[2]?.startsWith('cat ')) return REGISTRY
  if (argv[2]?.includes('grep -aiE')) return machine.logError ?? ''
  return argv[2]?.includes('echo last') && !machine.isOtherSessionOpen ? 'last\n' : ''
}

export function fakeMachine(on: On, files: Record<string, string> = { 'docker-compose.yml': COMPOSE, '.env': 'WEB_PORT=4321\n' }): Machine {
  const clock = mock.clock(on, { now: 1_000 })
  const machine: Machine = { wait: ms => clock.advance(ms), listening: [], files, ran: [], isGitBelow: true }
  on('session.start', async (_, e) => ({ cwd: e.cwd }))
  on('session.end', async (_, e) => ({ sessionId: e.sessionId }))
  on('session.id', async () => ({ value: 'session-1' }))
  on('command.register', async (_, e) => ({ value: { command: e.name } }))
  on('ui.open', async () => ({ value: { isPlaced: true as const } }))
  on('ui.render', async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const graph = h(Text, {}, 'the git graph')
    return (machine.isGitBelow ? h(Box, { key: 'git-graph' }, graph) : h(Text, {}, 'engine pane')) as RenderElement
  })
  on('fs.list', async () => ({ value: Object.keys(machine.files).map(name => ({ name, kind: 'file' as const, size: 1, mtimeMs: 0, isLink: false })) }))
  on('fs.read', async (_, e) => ({ value: machine.files[e.path.slice(ROOT.length + 1)] ?? '' }))
  on('process.run', async (_, e) => {
    machine.ran.push([...e.argv])
    return { value: { exitCode: 0, stdout: stdoutFor(e.argv, e.init?.cwd ?? ROOT, machine), stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  return machine
}

export async function settle() {
  for (let i = 0; i < 20; i++) await new Promise<void>(resolve => setTimeout(resolve, 0))
}

export async function open($: Engine, cwd = ROOT) {
  await $.session.start({ cwd, surface: 'terminal', isInteractive: true })
  await settle()
}

export const mountGit = ($: Engine, surface: 'terminal' | 'desktop' = 'terminal') =>
  $.ui.mount({ plugin: 'dev-apps', surface, component: 'Pane', requestId: 'branch-status', props: PANE_PROPS })

export const end = ($: Engine, reason: 'prompt_input_exit' | 'clear') =>
  $.session.end({ reason, sessionId: 'session-1', resume: { id: 'session-1' } })

export const composeRuns = (machine: Machine) => machine.ran.filter(argv => argv[4]?.includes('docker compose')).map(argv => argv[4]?.match(/docker compose [\w -]+$/)?.[0])
