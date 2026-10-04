import { expect, test } from 'claude-code/testing'

const GIT: Record<string, string> = {
  'rev-parse --abbrev-ref HEAD': 'feat\n',
  'rev-parse --verify -q main': 'aaa\n',
  'rev-list --left-right --count main...HEAD': '1\t2\n',
  'rev-parse --verify -q develop': 'bbb\n',
  'log --first-parent --format=%s main..develop': 'Merge pull request #88\n',
}

const PANE_PROPS = {
  title: 'Git',
  isFocused: false,
  bodyColumns: 60,
  placement: 'dock',
  scroll: { offset: 0, bodyRows: 30 },
  view: {},
} as const

for (const surface of ['terminal', 'desktop'] as const) {
  test(`the pane draws the branch, its drift from main and what develop holds on ${surface}`, async ($, on) => {
    const asked: string[] = []
    on('process.run', async (_, e) => {
      const line = e.argv.slice(1).join(' ')
      asked.push(line)
      const stdout = GIT[line]
      const result = { exitCode: stdout === undefined ? 1 : 0, stdout: stdout ?? '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false }
      return { value: result }
    })
    on('ui.open', async () => ({ value: { isPlaced: true as const } }))

    await $.command.run({ command: 'branch-status', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 160 } })
    const ui = await $.ui.mount({ plugin: 'branch-status', surface, component: 'Pane', requestId: 'branch-status', props: PANE_PROPS })

    expect(asked).toEqual(Object.keys(GIT))
    expect(await ui.find({ text: '⎇ feat' })).toBeDefined()
    expect(await ui.find({ text: '↑2 ahead' })).toBeDefined()
    expect(await ui.find({ text: '1 on develop, not on main' })).toBeDefined()
    expect(await ui.find({ text: 'nothing like this' })).toBeUndefined()
  })
}
