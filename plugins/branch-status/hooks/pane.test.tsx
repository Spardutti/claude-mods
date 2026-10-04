import { expect, test } from 'claude-code/testing'

const GIT: Record<string, string> = {
  'rev-parse --abbrev-ref HEAD': 'feat\n',
  'rev-parse --verify -q main': 'aaa\n',
  'rev-parse --verify -q origin/main': 'ccc\n',
  'rev-parse --verify -q develop': 'bbb\n',
  'rev-parse --verify -q origin/develop': 'ddd\n',
  'rev-list --no-merges --left-right --count origin/main...origin/develop': '0\t1\n',
  'log --first-parent --format=%H %s origin/main..origin/develop':
    'f00 Merge pull request #90 from org/chore/sync-main-into-develop\nabc Merge pull request #88 from org/feat/search\n',
  'rev-list --no-merges --count origin/main..f00^2': '0\n',
  'rev-list --no-merges --count origin/main..abc^2': '2\n',
  'rev-list --no-merges --left-right --count origin/develop...HEAD': '3\t2\n',
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
  test(`the pane draws main, develop and the branch as a graph on ${surface}`, async ($, on) => {
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
    expect(await ui.find({ text: '1 to release' })).toBeDefined()
    expect(await ui.find({ text: '2 commits' })).toBeDefined()
    expect(await ui.find({ text: 'develop has 3 new, pull it' })).toBeDefined()
    expect(await ui.find({ text: /#88 {2}feat\/search/ })).toBeDefined()
    expect(await ui.find({ text: /sync-main-into-develop/ })).toBeUndefined()
  })
}
