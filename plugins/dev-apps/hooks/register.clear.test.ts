import { expect, test } from 'claude-code/testing'

import { end, fakeMachine, mountGit, open } from './fake-machine'

// A /clear starts a new session: the host drops the session's state, and no session.start follows.
test('after a /clear the apps come back under the git graph', async ($, on) => {
  const machine = fakeMachine(on)
  let isCleared = false
  on('state.get', async (_, e, next) => (isCleared ? { value: { value: undefined, version: 0 } } : next(e)))
  on('state.set', async (_, e, next) => {
    isCleared = false
    return next(e)
  })
  await open($)

  await end($, 'clear')
  isCleared = true
  await machine.wait(3_000)

  expect(await (await mountGit($)).find({ text: /web stopped/ })).toBeDefined()
})
