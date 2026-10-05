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
  'for-each-ref --format=%(refname:short)%09%(upstream:track) refs/heads':
    'feat\t\nfeat/other\t\nold/merged\t[gone]\ndevelop\t\nmain\t[behind 2]\nrelease/1.0\t\n',
  'rev-list --no-merges --left-right --count origin/develop...HEAD': '3\t2\n',
  'log --no-merges --format=%s -n 5 origin/develop..HEAD': 'feat: search box\nfix: search empty state\n',
  'log --no-merges --cherry-pick --right-only --format=%H %s origin/main...feat/other': 'b2 feat: other work\n',
  'log --no-merges --cherry-pick --right-only --format=%H %s origin/develop...feat/other': 'b2 feat: other work\nb1 fix: already on main\n',
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
    expect(await ui.find({ text: 'feat: search box' })).toBeDefined()
    expect(await ui.find({ text: 'feat: other work' })).toBeDefined()
    expect(await ui.find({ text: 'fix: already on main' })).toBeUndefined()
    expect(await ui.find({ text: 'old/merged' })).toBeUndefined()
  })
}

test('a branch deleted on origin after its merge says so, with what to do', async ($, on) => {
  const git: Record<string, string> = { ...GIT, 'for-each-ref --format=%(refname:short)%09%(upstream:track) refs/heads': 'feat\t[gone]\n' }
  on('process.run', async (_, e) => {
    const stdout = git[e.argv.slice(1).join(' ')]
    return { value: { exitCode: stdout === undefined ? 1 : 0, stdout: stdout ?? '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('ui.open', async () => ({ value: { isPlaced: true as const } }))

  await $.command.run({ command: 'branch-status', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 160 } })
  const ui = await $.ui.mount({ plugin: 'branch-status', surface: 'terminal', component: 'Pane', requestId: 'branch-status', props: PANE_PROPS })

  expect(await ui.find({ text: 'merged into develop' })).toBeDefined()
  expect(await ui.find({ text: 'switch to develop and pull' })).toBeDefined()
  expect(await ui.find({ text: 'feat: search box' })).toBeUndefined()
})
