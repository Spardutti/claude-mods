import { expect, test } from 'claude-code/testing'

import { COMMAND, askInReply, blockBash, fakeShell, mount, settle, submit } from './fake-shell'

const ASKED = `You asked the user to run this command, and they ran it:\n$ git status\nExit code 0.\nOutput:\nMerged #12\n`

test('an ask after a block keeps the blocked command first', async ($, on) => {
  fakeShell(on)
  await blockBash($)

  await askInReply($, '! git status')

  expect(await (await mount($)).find({ text: new RegExp(`AUTO MODE BLOCKED .*${COMMAND} \\(then 1 more\\)`) })).toBeDefined()
})

test('an ask while a finished run waits for your message is kept', async ($, on) => {
  fakeShell(on)
  await blockBash($)
  await (await mount($)).press({ key: 'run' })

  await askInReply($, '! git status')
  await submit($)

  expect(await (await mount($)).find({ text: /CLAUDE ASKS YOU TO RUN .*git status/ })).toBeDefined()
})

test('a block while a command runs shows once the run ends', async ($, on) => {
  const { hold } = fakeShell(on)
  await askInReply($, '! git status')
  const release = hold()
  await (await mount($)).press({ key: 'run' })

  await blockBash($)
  release()
  await settle()

  expect(await (await mount($)).find({ text: new RegExp(`AUTO MODE BLOCKED .*${COMMAND}`) })).toBeDefined()
})

test('output sent during a run does not reach Claude twice', async ($, on) => {
  const { hold } = fakeShell(on)
  await askInReply($, `! ${COMMAND}\n! git status`)
  const ui = await mount($)
  await ui.press({ key: 'run' })
  const release = hold()
  await ui.press({ key: 'run' })
  await submit($)

  release()
  await settle()

  expect(await submit($)).toEqual([ASKED])
})
