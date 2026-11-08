import { expect, test } from 'claude-code/testing'

import { COMMAND, askInReply, blockBash, fakeShell, mount, submit } from './fake-shell'
import type { Engine } from './fake-shell'

test('a reply asking you to run a command shows it in the band', async ($, on) => {
  fakeShell(on)
  await askInReply($)

  const ui = await mount($)

  expect(await ui.find({ text: new RegExp(`CLAUDE ASKS YOU TO RUN .*${COMMAND}`) })).toBeDefined()
})

test('a reply with no command shows nothing', async ($, on) => {
  fakeShell(on)
  await askInReply($, 'All done.')

  const ui = await mount($)

  expect(await ui.find({ text: /CLAUDE ASKS/ })).toBeUndefined()
})

test('a run Claude asked for tells Claude it was asked for', async ($, on) => {
  fakeShell(on)
  await askInReply($)
  await (await mount($)).press({ key: 'run' })

  const sent = await $.prompt.submit({ text: 'done', wait: false, origin: { kind: 'composer' } })

  expect(sent.context).toEqual([
    `You asked the user to run this command, and they ran it:\n$ ${COMMAND}\nExit code 0.\nOutput:\nMerged #12\n`,
  ])
})

test('a new reply keeps the output of a finished run for Claude', async ($, on) => {
  fakeShell(on)
  await blockBash($)
  await (await mount($)).press({ key: 'run' })

  await askInReply($, '! git status')

  expect(await submit($)).toEqual([
    `Auto mode blocked this command, so the user ran it themselves:\n$ ${COMMAND}\nExit code 0.\nOutput:\nMerged #12\n\n\nNot run yet, still waiting above the prompt:\n$ git status`,
  ])
})

const TWO = `! ${COMMAND}\n! git status\n`
const askedNote = (command: string, output = 'Merged #12\n', code = 0) =>
  `You asked the user to run this command, and they ran it:\n$ ${command}\nExit code ${code}.\nOutput:\n${output}`

test('a reply asking for two commands shows the first with one more waiting', async ($, on) => {
  fakeShell(on)
  await askInReply($, TWO)

  const ui = await mount($)

  expect(await ui.find({ text: new RegExp(`${COMMAND} \\(then 1 more\\)`) })).toBeDefined()
})

test('a finished command brings up the next one', async ($, on) => {
  const { ran } = fakeShell(on)
  await askInReply($, TWO)
  const ui = await mount($)

  await ui.press({ key: 'run' })

  expect(ran.map(r => r.argv[2])).toEqual([COMMAND])
  expect(await ui.find({ text: /CLAUDE ASKS YOU TO RUN .*git status/ })).toBeDefined()
})

test('running the whole queue sends Claude every output', async ($, on) => {
  fakeShell(on)
  await askInReply($, TWO)
  const ui = await mount($)
  await ui.press({ key: 'run' })
  await ui.press({ key: 'run' })

  expect(await submit($)).toEqual([`${askedNote(COMMAND)}\n\n${askedNote('git status')}`])
})

test('a failed command stops the queue', async ($, on) => {
  const { ran } = fakeShell(on, 1)
  await askInReply($, TWO)

  await (await mount($)).press({ key: 'run' })

  expect(ran.map(r => r.argv[2])).toEqual([COMMAND])
})

test('a failed command tells Claude what did not run', async ($, on) => {
  fakeShell(on, 1)
  await askInReply($, TWO)
  await (await mount($)).press({ key: 'run' })

  expect(await submit($)).toEqual([`${askedNote(COMMAND, 'Merged #12\n', 1)}\n\nNot run, because the command before it failed:\n$ git status`])
})

test('Skip the rest tells Claude what the user chose not to run', async ($, on) => {
  fakeShell(on)
  await askInReply($, TWO)
  const ui = await mount($)
  await ui.press({ key: 'run' })

  await ui.press({ key: 'dismiss' })

  expect(await submit($)).toEqual([`${askedNote(COMMAND)}\n\nThe user chose not to run:\n$ git status`])
})

test('a message sent mid-queue tells Claude what has not run yet', async ($, on) => {
  fakeShell(on)
  await askInReply($, TWO)
  await (await mount($)).press({ key: 'run' })

  expect(await submit($)).toEqual([`${askedNote(COMMAND)}\n\nNot run yet, still waiting above the prompt:\n$ git status`])
})

test('a message sent mid-queue keeps the next command in the band', async ($, on) => {
  fakeShell(on)
  await askInReply($, TWO)
  const ui = await mount($)
  await ui.press({ key: 'run' })

  await submit($)

  expect(await ui.find({ text: /CLAUDE ASKS YOU TO RUN .*git status/ })).toBeDefined()
})

test('a reply with no command clears an ask nobody ran', async ($, on) => {
  fakeShell(on)
  await askInReply($)

  await askInReply($, 'Done, I see you pushed it.')

  expect(await (await mount($)).find({ text: /CLAUDE ASKS/ })).toBeUndefined()
})
