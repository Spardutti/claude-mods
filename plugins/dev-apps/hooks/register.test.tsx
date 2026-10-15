import { expect, test } from 'claude-code/testing'
import type { RenderElement } from 'claude-code'
import type { TestBody } from 'claude-code/testing'

type Engine = Parameters<TestBody>[0]
type On = Parameters<TestBody>[1]
type Machine = { listening: number[]; files: Record<string, string>; ran: string[][]; isOtherSessionOpen?: boolean; isGitBelow: boolean }

// The test runtime has timers; the mod's type roots leave them out.
declare function setTimeout(run: () => void, ms: number): unknown

const ROOT = '/home/me/projects/shop'
const REGISTRY = '4321\tshop\tweb\n4322\tshop\tbackoffice\n4323\tshop\tapi\n'
const COMPOSE = 'services:\n  web:\n    ports:\n      - "${WEB_PORT}:4321"\n'
const PANE_PROPS = { title: 'Git', isFocused: false, bodyColumns: 50, placement: 'dock', scroll: { offset: 0, bodyRows: 20 }, view: {} } as const

function stdoutFor(argv: readonly string[], cwd: string, machine: Machine) {
  if (argv[0] === 'git') return argv.includes('--git-common-dir') ? `${cwd}/.git\n` : `${cwd}\n`
  if (argv[0] === 'ss') return machine.listening.map(port => `LISTEN 0 511 0.0.0.0:${port} 0.0.0.0:*`).join('\n')
  if (argv[2]?.startsWith('cat ')) return REGISTRY
  return argv[2]?.includes('echo last') && !machine.isOtherSessionOpen ? 'last\n' : ''
}

function fakeMachine(on: On, files: Record<string, string> = { 'docker-compose.yml': COMPOSE, '.env': 'WEB_PORT=4321\n' }): Machine {
  const machine: Machine = { listening: [], files, ran: [], isGitBelow: true }
  on('session.start', async (_, e) => ({ cwd: e.cwd }))
  on('session.end', async (_, e) => ({ sessionId: e.sessionId }))
  on('session.id', async () => ({ value: 'session-1' }))
  on('command.register', async (_, e) => ({ value: { command: e.name } }))
  on('clock.every', () => new Promise(() => {}))
  on('clock.now', async () => ({ value: 1_000 }))
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

async function settle() {
  for (let i = 0; i < 20; i++) await new Promise<void>(resolve => setTimeout(resolve, 0))
}

async function open($: Engine, cwd = ROOT) {
  await $.session.start({ cwd, surface: 'terminal', isInteractive: true })
  await settle()
}

const mountGit = ($: Engine, surface: 'terminal' | 'desktop' = 'terminal') =>
  $.ui.mount({ plugin: 'dev-apps', surface, component: 'Pane', requestId: 'branch-status', props: PANE_PROPS })

const end = ($: Engine, reason: 'prompt_input_exit' | 'clear') =>
  $.session.end({ reason, sessionId: 'session-1', resume: { id: 'session-1' } })

const composeRuns = (machine: Machine) => machine.ran.filter(argv => argv[4]?.includes('docker compose')).map(argv => argv[4]?.match(/docker compose [\w -]+$/)?.[0])

for (const surface of ['terminal', 'desktop'] as const) {
  test(`the git pane keeps the graph on top and lists the browser apps under it on ${surface}`, async ($, on) => {
    const machine = fakeMachine(on)
    machine.listening = [4321]
    await open($)

    const ui = await mountGit($, surface)

    expect(await ui.find({ text: 'the git graph' })).toBeDefined()
    expect(await ui.find({ text: /web running/ })).toBeDefined()
    expect(await ui.find({ text: /backoffice stopped/ })).toBeDefined()
    expect(await ui.find({ text: /api/ })).toBeUndefined()
    expect(await ui.find({ text: 'http://localhost:4321' })).toBeDefined()
  })
}

test('a project with no browser apps leaves the git pane as it was', async ($, on) => {
  fakeMachine(on)
  await open($, '/home/me/projects/other')

  const ui = await mountGit($)

  expect(await ui.find({ text: 'the git graph' })).toBeDefined()
  expect(await ui.find({ text: /Apps/ })).toBeUndefined()
})

test('start runs docker compose up in the project folder and shows starting', async ($, on) => {
  const machine = fakeMachine(on)
  await open($)
  const ui = await mountGit($)

  await ui.press({ key: 'start' })
  await settle()

  expect(composeRuns(machine)).toEqual(['docker compose up -d'])
  expect(await ui.find({ text: /web starting/ })).toBeDefined()
})

test('stop runs docker compose down', async ($, on) => {
  const machine = fakeMachine(on)
  machine.listening = [4321, 4322]
  await open($)
  const ui = await mountGit($)

  await ui.press({ key: 'stop' })
  await settle()

  expect(composeRuns(machine)).toEqual(['docker compose down'])
})

test('pressing stop shows stopping and hides the buttons while the apps still answer', async ($, on) => {
  const machine = fakeMachine(on)
  machine.listening = [4321, 4322]
  await open($)
  const ui = await mountGit($)

  await ui.press({ key: 'stop' })
  await settle()

  expect(await ui.find({ text: /web stopping/ })).toBeDefined()
  expect([await ui.find({ key: 'stop' }), await ui.find({ key: 'start' })]).toEqual([undefined, undefined])
})

test('no file naming the ports shows Open only, with no start button', async ($, on) => {
  fakeMachine(on, { 'package.json': '{"scripts":{"dev":"vite"}}' })
  await open($)

  const ui = await mountGit($)

  expect(await ui.find({ text: 'No start command found. Open only.' })).toBeDefined()
  expect(await ui.find({ key: 'start' })).toBeUndefined()
})

test('the last session to exit stops the project', async ($, on) => {
  const machine = fakeMachine(on)
  await open($)

  await end($, 'prompt_input_exit')

  expect(composeRuns(machine)).toEqual(['docker compose down'])
})

test('a /clear does not stop the project', async ($, on) => {
  const machine = fakeMachine(on)
  await open($)

  await end($, 'clear')

  expect(composeRuns(machine)).toEqual([])
})

test('exiting while another session has the project open leaves it running', async ($, on) => {
  const machine = fakeMachine(on)
  machine.isOtherSessionOpen = true
  await open($)

  await end($, 'prompt_input_exit')

  expect(composeRuns(machine)).toEqual([])
})

test('drawn before branch-status, it hands up the apps alone, tagged for branch-status to stack', async ($, on) => {
  const machine = fakeMachine(on)
  machine.isGitBelow = false
  await open($)

  const drawn = await (await mountGit($)).drawn()

  expect(JSON.stringify(drawn)).toContain('"key":"dev-apps"')
  expect(JSON.stringify(drawn)).not.toContain('engine pane')
})
