import { expect, test } from 'claude-code/testing'
import type { RenderElement } from 'claude-code'
import type { TestBody } from 'claude-code/testing'

const HOUR = 3_600_000
const NOW = 100 * 24 * HOUR
const PATH = '.claude/handoffs/2026-10-02-fix-login.md'

type Engine = Parameters<TestBody>[0]
type On = Parameters<TestBody>[1]
type Seen = { listed: string[]; removed: string[][] }

function fakeProject(on: On, ageMs = 3 * 24 * HOUR): Seen {
  const seen: Seen = { listed: [], removed: [] }
  on('session.start', async (_, e) => ({ cwd: e.cwd }))
  on('command.register', async (_, e) => ({ value: { command: e.name } }))
  on('clock.every', () => new Promise(() => {}))
  on('prompt.submit', async (_, e) => ({ text: e.text }))
  on('clock.now', async () => ({ value: NOW }))
  on('fs.list', async (_, e) => {
    seen.listed.push(e.path)
    return { value: [{ name: '2026-10-02-fix-login.md', kind: 'file' as const, size: 1, mtimeMs: NOW - ageMs, isLink: false }] }
  })
  on('fs.read', async () => ({ value: '# Handoff — Fix the login redirect\n' }))
  on('process.run', async (_, e) => {
    seen.removed.push([...e.argv])
    return { value: { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  return seen
}

const start = ($: Engine) => $.session.start({ cwd: '/project', surface: 'terminal', isInteractive: true })
const pickup = ($: Engine, args = '') =>
  $.command.run({ command: 'pickup', args, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 120 } })

test('/pickup leaves Claude a note to read the waiting handoff', async ($, on) => {
  fakeProject(on)
  await start($)

  const result = await pickup($)

  expect(result.text).toBe('Picked up: Fix the login redirect. Send any message to start.')
  expect(result.context).toEqual([`Read ${PATH} and continue from it. When the work is done, tell the person to run /pickup done to delete it.`])
})

test('/pickup done deletes the handoff this session picked up', async ($, on) => {
  const seen = fakeProject(on)
  await start($)
  await pickup($)

  const result = await pickup($, 'done')

  expect(seen.removed).toEqual([['rm', '--', PATH]])
  expect(result.text).toBe(`Deleted ${PATH}.`)
})

test('/pickup done without a pickup deletes nothing', async ($, on) => {
  const seen = fakeProject(on)
  await start($)

  const result = await pickup($, 'done')

  expect(seen.removed).toEqual([])
  expect(result.text).toBe('Nothing picked up in this session. Run /pickup first.')
})

test("a handoff auto-handoff resumed counts as picked up", async ($, on) => {
  const seen = fakeProject(on)
  await start($)
  await $.prompt.submit({ text: `Read ${PATH} and continue.`, wait: false, origin: { kind: 'composer' } })

  await pickup($, 'done')

  expect(seen.removed).toEqual([['rm', '--', PATH]])
})

test('a handoff under an hour old is not offered', async ($, on) => {
  fakeProject(on, HOUR - 1)
  await start($)

  expect((await pickup($)).text).toBe('No handoff waiting in .claude/handoffs.')
})

test('the folder setting is where it looks', { options: { folder: 'notes/handoffs/' } }, async ($, on) => {
  const seen = fakeProject(on)
  await start($)

  expect(seen.listed.map(path => path.endsWith('/notes/handoffs'))).toEqual([true])
})

const BAND_PROPS = { hasSurvey: false, isWorking: false, maxRows: 4, bodyColumns: 100, scroll: { offset: 0, bodyRows: 4 }, view: {} } as const

for (const surface of ['terminal', 'desktop'] as const) {
  test(`the strip names the waiting handoff on ${surface}`, async ($, on) => {
    fakeProject(on)
    await start($)

    const ui = await $.ui.mount({ plugin: 'handoff-pickup', surface, component: 'AbovePrompt', props: BAND_PROPS })

    expect(await ui.find({ text: /Fix the login redirect \(3 days ago\)/ })).toBeDefined()
  })
}

test('the strip goes away once the handoff is picked up', async ($, on) => {
  fakeProject(on)
  on('ui.render', async ($, e) => h($.ui.resolve(e).Text, {}, 'engine band') as RenderElement)
  await start($)
  await pickup($)

  const ui = await $.ui.mount({ plugin: 'handoff-pickup', surface: 'terminal', component: 'AbovePrompt', props: BAND_PROPS })

  expect(await ui.find({ text: /Handoff waiting/ })).toBeUndefined()
  expect(await ui.find({ text: 'engine band' })).toBeDefined()
})
