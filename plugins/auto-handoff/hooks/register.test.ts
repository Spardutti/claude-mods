import { expect, test } from 'claude-code/testing'

import { COUNTDOWN_MS, endTurn, fakeSession, PATH, WRITTEN } from './fake-session'
import type { Engine } from './fake-session'

test('above the threshold, the handoff is written, then a fresh named session resumes from it', async ($, on) => {
  const seen = fakeSession(on, { percent: 61, commands: ['handoff'] })

  await endTurn($)
  await seen.wait(COUNTDOWN_MS)
  await endTurn($, { answer: WRITTEN })

  expect(seen.ran).toEqual(['handoff', 'clear', 'rename Fix the login redirect'])
  expect(seen.prompts).toEqual([`Read ${PATH} and continue.`])
})

test('exactly at the threshold, the handoff starts', async ($, on) => {
  const seen = fakeSession(on, { percent: 60, commands: ['handoff'] })

  await endTurn($)
  await seen.wait(COUNTDOWN_MS)

  expect(seen.ran).toEqual(['handoff'])
})

test('below the threshold nothing happens', async ($, on) => {
  const seen = fakeSession(on, { percent: 59, commands: ['handoff'] })

  await endTurn($)

  expect([seen.ran, seen.prompts]).toEqual([[], []])
})

test('a raised threshold setting holds the handoff back', { options: { threshold: 80 } }, async ($, on) => {
  const seen = fakeSession(on, { percent: 70, commands: ['handoff'] })

  await endTurn($)
  await seen.wait(COUNTDOWN_MS)

  expect(seen.ran).toEqual([])
})

test('without a handoff command, the session compacts', async ($, on) => {
  const seen = fakeSession(on, { percent: 61, commands: ['review'] })

  await endTurn($)
  await seen.wait(COUNTDOWN_MS)

  expect(seen.ran).toEqual(['compact'])
})

test('when the handoff skill writes no file, the session compacts instead of clearing', async ($, on) => {
  const seen = fakeSession(on, { percent: 61, commands: ['handoff'] })

  await endTurn($)
  await seen.wait(COUNTDOWN_MS)
  await endTurn($, { answer: "I didn't write a handoff file." })

  expect(seen.ran).toEqual(['handoff', 'compact'])
})

for (const [name, fields] of [
  ['a subagent turn', { agentId: 'agent-1' }],
  ['an interrupted turn', { reason: 'aborted' }],
] as const) {
  test(`${name} never starts a handoff`, async ($, on) => {
    const seen = fakeSession(on, { percent: 90, commands: ['handoff'] })

    await endTurn($, fields)
    await seen.wait(COUNTDOWN_MS)

    expect(seen.ran).toEqual([])
  })
}

test('two turns ending during one countdown start the handoff once', async ($, on) => {
  const seen = fakeSession(on, { percent: 61, commands: ['handoff'] })

  await endTurn($)
  await seen.wait(2000)
  await endTurn($)
  await seen.wait(3 * COUNTDOWN_MS)

  expect(seen.ran).toEqual(['handoff'])
})

test('the handoff waits out the countdown before it starts', async ($, on) => {
  const seen = fakeSession(on, { percent: 61, commands: ['handoff'] })

  await endTurn($)
  await seen.wait(COUNTDOWN_MS - 1000)

  expect(seen.ran).toEqual([])
})

const BAND_PROPS = { hasSurvey: false, isWorking: false, maxRows: 4, bodyColumns: 100, scroll: { offset: 0, bodyRows: 4 }, view: {} } as const
const band = ($: Engine, surface: 'terminal' | 'desktop' = 'terminal') =>
  $.ui.mount({ plugin: 'auto-handoff', surface, component: 'AbovePrompt', props: BAND_PROPS })

for (const surface of ['terminal', 'desktop'] as const) {
  test(`the band counts down the seconds left on ${surface}`, async ($, on) => {
    const seen = fakeSession(on, { percent: 61, commands: ['handoff'] })

    await endTurn($)
    await seen.wait(3000)

    expect(await (await band($, surface)).find({ text: 'Context at 61%. Handing off in 7s. ' })).toBeDefined()
  })
}

test('Not now stops the handoff from starting', async ($, on) => {
  const seen = fakeSession(on, { percent: 61, commands: ['handoff'] })
  await endTurn($)

  await (await band($)).press({ key: 'not-now' })
  await seen.wait(COUNTDOWN_MS)

  expect(seen.ran).toEqual([])
})

test('Not now clears the band', async ($, on) => {
  fakeSession(on, { percent: 61, commands: ['handoff'] })
  await endTurn($)
  const ui = await band($)

  await ui.press({ key: 'not-now' })

  expect(await ui.find({ text: /Context at/ })).toBeUndefined()
})

test('a message sent during the countdown stops it', async ($, on) => {
  const seen = fakeSession(on, { percent: 61, commands: ['handoff'] })
  await endTurn($)

  await $.prompt.submit({ text: 'one more thing', wait: false, origin: { kind: 'composer' } })
  await seen.wait(COUNTDOWN_MS)

  expect(seen.ran).toEqual([])
})

test('five points under the threshold, the band warns early', async ($, on) => {
  fakeSession(on, { percent: 55, commands: ['handoff'] })

  await endTurn($)

  expect(await (await band($)).find({ text: 'Context at 55%. Handoff starts at 60%.' })).toBeDefined()
})

test('six points under the threshold, the band stays empty', async ($, on) => {
  fakeSession(on, { percent: 54, commands: ['handoff'] })

  await endTurn($)

  expect(await (await band($)).find({ text: /Context at/ })).toBeUndefined()
})
