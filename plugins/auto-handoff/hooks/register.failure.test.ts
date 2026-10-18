import { expect, test } from 'claude-code/testing'

import { band, COUNTDOWN_MS, endTurn, fakeSession, WRITTEN } from './fake-session'
import type { Engine, Seen } from './fake-session'

const ASK_AGAIN = 'No new handoff note turned up. Write it under .claude/handoffs/ now, then reply with its path.'
const NO_NOTE = "I didn't write a handoff file."

test('without a handoff command, nothing runs', async ($, on) => {
  const seen = fakeSession(on, { percent: 61, commands: ['review'] })

  await endTurn($)
  await seen.wait(COUNTDOWN_MS)

  expect(seen.ran).toEqual([])
})

test('without a handoff command, the band says the handoff failed', async ($, on) => {
  const seen = fakeSession(on, { percent: 61, commands: ['review'] })

  await endTurn($)
  await seen.wait(COUNTDOWN_MS)

  expect(await (await band($)).find({ text: 'Handoff failed: no /handoff command found. Nothing was cleared. Run /handoff yourself.' })).toBeDefined()
})

test('when the handoff skill writes no file, Claude is asked once more', async ($, on) => {
  const seen = fakeSession(on, { percent: 61, commands: ['handoff'] })

  await endTurn($)
  await seen.wait(COUNTDOWN_MS)
  await endTurn($, { answer: NO_NOTE })

  expect([seen.ran, seen.prompts]).toEqual([['handoff'], [ASK_AGAIN]])
})

test('a note written on the second ask resumes the fresh session', async ($, on) => {
  const seen = fakeSession(on, { percent: 61, commands: ['handoff'] })
  await endTurn($)
  await seen.wait(COUNTDOWN_MS)
  await endTurn($, { answer: NO_NOTE })

  await endTurn($, { answer: WRITTEN })

  expect(seen.ran).toEqual(['handoff', 'clear', 'rename Fix the login redirect'])
})

async function failTwice($: Engine, seen: Seen) {
  await endTurn($)
  await seen.wait(COUNTDOWN_MS)
  await endTurn($, { answer: NO_NOTE })
  await endTurn($, { answer: NO_NOTE })
}

test('a second answer without a note never clears or asks again', async ($, on) => {
  const seen = fakeSession(on, { percent: 61, commands: ['handoff'] })

  await failTwice($, seen)

  expect([seen.ran, seen.prompts]).toEqual([['handoff'], [ASK_AGAIN]])
})

test('a second answer without a note shows the failure band', async ($, on) => {
  const seen = fakeSession(on, { percent: 61, commands: ['handoff'] })

  await failTwice($, seen)

  expect(await (await band($)).find({ text: 'Handoff failed: no handoff note was written. Nothing was cleared. Run /handoff yourself.' })).toBeDefined()
})

test('after a failed handoff, later turns above the threshold do not count down again', async ($, on) => {
  const seen = fakeSession(on, { percent: 61, commands: ['review'] })
  await endTurn($)
  await seen.wait(COUNTDOWN_MS)

  await endTurn($)

  expect(await (await band($)).find({ text: /Handing off in/ })).toBeUndefined()
})

test('once the context drops below the threshold, the failure band goes away', async ($, on) => {
  const fake = { percent: 61, commands: ['review'] }
  const seen = fakeSession(on, fake)
  await endTurn($)
  await seen.wait(COUNTDOWN_MS)

  fake.percent = 20
  await endTurn($)

  expect(await (await band($)).find({ text: /Handoff failed/ })).toBeUndefined()
})

