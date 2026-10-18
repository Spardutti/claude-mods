import { expect, test } from 'claude-code/testing'

import { COUNTDOWN_MS, endTurn, fakeSession, PATH, WRITTEN } from './fake-session'
import type { Engine, Seen } from './fake-session'

const FOLD_IN = `The background work finished. Add its results to ${PATH}, then reply with that path.`
const ASK_AGAIN = 'No new handoff note turned up. Write it under .claude/handoffs/ now, then reply with its path.'
const RESUMED = ['handoff', 'clear', 'rename Fix the login redirect']

async function handOff($: Engine, seen: Seen, backgroundTasks: string[] = []) {
  await endTurn($)
  await seen.wait(COUNTDOWN_MS)
  await endTurn($, { answer: WRITTEN, backgroundTasks })
}

test('while background work runs, the session is not cleared', async ($, on) => {
  const seen = fakeSession(on, { percent: 61, commands: ['handoff'] })

  await handOff($, seen, ['subagent'])

  expect([seen.ran, seen.prompts]).toEqual([['handoff'], []])
})

test('once background work ends, Claude is asked to add its results to the handoff', async ($, on) => {
  const seen = fakeSession(on, { percent: 61, commands: ['handoff'] })
  await handOff($, seen, ['subagent'])

  await endTurn($, { answer: 'The tests passed.' })

  expect([seen.ran, seen.prompts]).toEqual([['handoff'], [FOLD_IN]])
})

test('after the results are added, the fresh session resumes', async ($, on) => {
  const seen = fakeSession(on, { percent: 61, commands: ['handoff'] })
  await handOff($, seen, ['subagent'])
  await endTurn($, { answer: 'The tests passed.' })

  await endTurn($, { answer: WRITTEN })

  expect(seen.ran).toEqual(RESUMED)
})

for (const kind of ['shell', 'monitor', 'artifact watch']) {
  test(`a running ${kind} does not hold the handoff back`, async ($, on) => {
    const seen = fakeSession(on, { percent: 61, commands: ['handoff'] })

    await handOff($, seen, [kind])

    expect(seen.ran).toEqual(RESUMED)
  })
}

test('the fresh session is told which background tasks may still report back', async ($, on) => {
  const seen = fakeSession(on, { percent: 61, commands: ['handoff'] })

  await handOff($, seen, ['shell'])

  expect(seen.prompts[0]).toMatch(/not the user's answer:\n- Launch the shell$/)
})

test('a running workflow holds the handoff back', async ($, on) => {
  const seen = fakeSession(on, { percent: 61, commands: ['handoff'] })

  await handOff($, seen, ['workflow'])

  expect([seen.ran, seen.prompts]).toEqual([['handoff'], []])
})

test('a handoff file older than this handoff is refused, and the session is not cleared', async ($, on) => {
  const seen = fakeSession(on, { percent: 61, commands: ['handoff'], handoffAgeMs: 60_000 })

  await handOff($, seen)

  expect([seen.ran, seen.prompts]).toEqual([['handoff'], [ASK_AGAIN]])
})

test('a fresh session that starts above the threshold does not hand off again', async ($, on) => {
  const fake = { percent: 61, commands: ['handoff'] }
  const seen = fakeSession(on, fake)
  await handOff($, seen)

  fake.percent = 70
  await endTurn($)
  await seen.wait(COUNTDOWN_MS)

  expect(seen.ran).toEqual(RESUMED)
})

test('a fresh session hands off again once it grows 10 points past its start', async ($, on) => {
  const fake = { percent: 61, commands: ['handoff'] }
  const seen = fakeSession(on, fake)
  await handOff($, seen)
  await endTurn($)

  fake.percent = 71
  await endTurn($)
  await seen.wait(COUNTDOWN_MS)

  expect(seen.ran).toEqual([...RESUMED, 'handoff'])
})
