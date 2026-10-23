import { expect, test } from 'claude-code/testing'

import { fakeMachine, mountGit, open, settle } from './fake-machine'
import type { Engine, On } from './fake-machine'

const RUNNING = '{"Service":"web","State":"running"}\n{"Service":"db","State":"running"}\n'

async function buttonsWith($: Engine, on: On, setup: { listening: number[]; ps: string }) {
  const machine = fakeMachine(on)
  Object.assign(machine, setup)
  await open($)
  const ui = await mountGit($)
  return [await ui.find({ key: 'start' }), await ui.find({ key: 'stop' })].map(Boolean)
}

test('with every app and container up, only Stop shows', async ($, on) => {
  expect(await buttonsWith($, on, { listening: [4321, 4322], ps: RUNNING })).toEqual([false, true])
})

test('a crashed container with the apps up shows Start next to Stop', async ($, on) => {
  const ps = '{"Service":"web","State":"running"}\n{"Service":"db","State":"exited","ExitCode":1}\n'

  expect(await buttonsWith($, on, { listening: [4321, 4322], ps })).toEqual([true, true])
})

test('a database left up with no app answering shows Stop', async ($, on) => {
  const ps = '{"Service":"db","State":"running"}\n'

  expect(await buttonsWith($, on, { listening: [], ps })).toEqual([true, true])
})

test('with nothing up, only Start shows', async ($, on) => {
  expect(await buttonsWith($, on, { listening: [], ps: '' })).toEqual([true, false])
})

test('a stop stays pending while a container is still up, even with no app answering', async ($, on) => {
  const machine = fakeMachine(on)
  machine.listening = [4321, 4322]
  machine.ps = RUNNING
  await open($)
  const ui = await mountGit($)
  await ui.press({ key: 'stop' })
  await settle()

  machine.listening = []
  await machine.wait(3_000)
  await settle()

  expect([await ui.find({ key: 'start' }), await ui.find({ key: 'stop' })]).toEqual([undefined, undefined])
})

test('every compose container shows, a crashed one with its exit code', async ($, on) => {
  const machine = fakeMachine(on)
  machine.listening = [4321]
  machine.ps = '{"Service":"web","State":"running","Health":"","ExitCode":0}\n{"Service":"db","State":"exited","Health":"","ExitCode":1}\n'
  await open($)

  const ui = await mountGit($)

  expect([await ui.find({ text: /web running/ }), await ui.find({ text: /db crashed, code 1/ })].map(Boolean)).toEqual([true, true])
})

test('a container left up after a failed start shows as running', async ($, on) => {
  const machine = fakeMachine(on)
  machine.ps = '{"Service":"db","State":"running","Health":"","ExitCode":0}\n'
  await open($)

  const ui = await mountGit($)

  expect([await ui.find({ text: /db running/ }), await ui.find({ text: /web stopped/ })].map(Boolean)).toEqual([true, true])
})
