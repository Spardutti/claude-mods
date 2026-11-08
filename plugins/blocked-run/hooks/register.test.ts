import { expect, test } from 'claude-code/testing'

import { COMMAND, blockBash, fakeShell, mount } from './fake-shell'
import type { Engine } from './fake-shell'

for (const surface of ['terminal', 'desktop'] as const) {
  test(`the band shows the blocked command on ${surface}`, async ($, on) => {
    fakeShell(on)
    await blockBash($)

    const ui = await mount($, surface)

    expect(await ui.find({ text: new RegExp(COMMAND) })).toBeDefined()
  })
}

test('a blocked non-Bash tool shows nothing', async ($, on) => {
  fakeShell(on)
  await blockBash($, 'Write')

  const ui = await mount($)

  expect(await ui.find({ text: /AUTO MODE BLOCKED/ })).toBeUndefined()
})

test('Run it myself runs the exact command in the project', async ($, on) => {
  const { ran } = fakeShell(on)
  await blockBash($)
  const ui = await mount($)

  await ui.press({ key: 'run' })

  expect(ran).toEqual([{ argv: ['bash', '-c', COMMAND], cwd: '/project' }])
})

test('the next message carries the output to Claude', async ($, on) => {
  fakeShell(on)
  await blockBash($)
  await (await mount($)).press({ key: 'run' })

  const sent = await $.prompt.submit({ text: 'done', wait: false, origin: { kind: 'composer' } })

  expect(sent.context).toEqual([
    `Auto mode blocked this command, so the user ran it themselves:\n$ ${COMMAND}\nExit code 0.\nOutput:\nMerged #12\n`,
  ])
})

test('Dismiss hides the band without running anything', async ($, on) => {
  const { ran } = fakeShell(on)
  await blockBash($)
  const ui = await mount($)

  await ui.press({ key: 'dismiss' })

  expect(ran).toEqual([])
  expect(await ui.find({ text: /AUTO MODE BLOCKED/ })).toBeUndefined()
})

test('a block pops a toast pointing at the band', async ($, on) => {
  const { toasts } = fakeShell(on)

  await blockBash($)

  expect(toasts).toEqual(['Auto mode blocked a command. Run it yourself from above the prompt.'])
})

test('a finished run shows DONE with the last output line', async ($, on) => {
  fakeShell(on)
  await blockBash($)
  const ui = await mount($)

  await ui.press({ key: 'run' })

  expect(await ui.find({ text: / DONE .*Merged #12/ })).toBeDefined()
})

test('a failed run shows FAILED with its exit code', async ($, on) => {
  fakeShell(on, 1)
  await blockBash($)
  const ui = await mount($)

  await ui.press({ key: 'run' })

  expect(await ui.find({ text: /FAILED \(exit 1\)/ })).toBeDefined()
})

test('the band clears once the next message carries the output', async ($, on) => {
  fakeShell(on)
  await blockBash($)
  const ui = await mount($)
  await ui.press({ key: 'run' })

  await $.prompt.submit({ text: 'done', wait: false, origin: { kind: 'composer' } })

  expect(await ui.find({ text: / DONE / })).toBeUndefined()
})

const noteAfterRun = async ($: Engine) => {
  await blockBash($)
  await (await mount($)).press({ key: 'run' })
  return (await $.prompt.submit({ text: 'done', wait: false, origin: { kind: 'composer' } })).context?.[0]
}
const noteWith = (output: string) => `Auto mode blocked this command, so the user ran it themselves:\n$ ${COMMAND}\nExit code 0.\nOutput:\n${output}`

test('output of exactly 4000 characters reaches Claude whole', async ($, on) => {
  const output = 'a'.repeat(4000)
  fakeShell(on, 0, output)

  expect(await noteAfterRun($)).toBe(noteWith(output))
})

test('output past 4000 characters reaches Claude as its last 4000', async ($, on) => {
  fakeShell(on, 0, `b${'a'.repeat(4000)}`)

  expect(await noteAfterRun($)).toBe(noteWith(`...${'a'.repeat(4000)}`))
})
