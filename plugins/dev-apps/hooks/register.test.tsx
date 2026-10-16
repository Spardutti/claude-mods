import { expect, test } from 'claude-code/testing'

import { COMPOSE, composeRuns, end, fakeMachine, mountGit, open, settle } from './fake-machine'
import type { Engine } from './fake-machine'

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

test('a start that failed offers Start again', async ($, on) => {
  const machine = fakeMachine(on)
  await open($)
  const pressed = await mountGit($)
  await pressed.press({ key: 'start' })
  await settle()
  await pressed.unmount()

  await machine.wait(91_000)
  const ui = await mountGit($)

  expect([await ui.find({ text: /web failed/ }), await ui.find({ key: 'start' })].map(Boolean)).toEqual([true, true])
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

async function pressStop($: Engine, on: On) {
  const machine = fakeMachine(on)
  machine.listening = [4321, 4322]
  await open($)
  const ui = await mountGit($)
  await ui.press({ key: 'stop' })
  await settle()
  return ui
}

test('pressing stop shows stopping while the apps still answer', async ($, on) => {
  const ui = await pressStop($, on)

  expect(await ui.find({ text: /web stopping/ })).toBeDefined()
})

test('pressing stop hides the buttons while the apps still answer', async ($, on) => {
  const ui = await pressStop($, on)

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
