import { expect, test } from 'claude-code/testing'
import type { RenderElement } from 'claude-code'
import type { TestBody } from 'claude-code/testing'

type Engine = Parameters<TestBody>[0]
type On = Parameters<TestBody>[1]

const COMMAND = 'gh pr merge 12 --squash'
const BAND_PROPS = { hasSurvey: false, isWorking: false, maxRows: 4, bodyColumns: 100, scroll: { offset: 0, bodyRows: 4 }, view: {} } as const

function fakeShell(on: On, exitCode = 0, output = 'Merged #12\n') {
  const ran: { argv: string[]; cwd?: string }[] = []
  const toasts: string[] = []
  on('session.start', async (_, e) => ({ cwd: e.cwd }))
  on('classic.PermissionDenied', async () => ({}))
  on('prompt.submit', async (_, e) => ({ text: e.text, context: e.context }))
  on('ui.render', async ($, e) => h($.ui.resolve(e).Text, {}, 'engine band') as RenderElement)
  on('ui.toast', async (_, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('process.spawn', async function* (_, e) {
    ran.push({ argv: [...e.argv], cwd: e.cwd })
    yield { stream: 'stdout' as const, text: output }
    return { value: { code: exitCode, signal: null } }
  })
  return { ran, toasts }
}

async function blockBash($: Engine, tool = 'Bash') {
  await $.session.start({ cwd: '/project', surface: 'terminal', isInteractive: true })
  await $.classic.PermissionDenied({ tool_name: tool, tool_input: { command: COMMAND }, tool_use_id: 't1', reason: 'merge' })
}

const mount = ($: Engine, surface: 'terminal' | 'desktop' = 'terminal') =>
  $.ui.mount({ plugin: 'blocked-run', surface, component: 'AbovePrompt', props: BAND_PROPS })

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
