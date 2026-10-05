import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Snapshot } from '../types'
import { drawLanes, shortSubject } from './graph'
import type { Lane } from './graph'
import { BASE, RELEASE, collect } from './snapshot'

const PANE = 'branch-status'
const PANE_COLUMNS = 56
const snapshot = atom({ plugin: 'branch-status', key: 'snapshot' } as const, { branch: '' } as Snapshot)

let isRefreshing = false

async function refresh($: EngineInterface) {
  if (isRefreshing) return
  isRefreshing = true
  try {
    const next = await collect(async args => {
      const { exitCode, stdout } = await $.process.run(['git', ...args])
      return exitCode === 0 ? stdout : undefined
    })
    await update($, snapshot, () => next)
  } finally {
    isRefreshing = false
  }
}

const commitCount = (n: number) => `${n} commit${n === 1 ? '' : 's'}`

function releaseLane(release: NonNullable<Snapshot['release']>, branch: string): Lane {
  return {
    name: RELEASE,
    color: 'yellow',
    depth: 1,
    note: release.merges.length ? { text: `${release.merges.length} to release`, color: 'yellow' } : { text: 'all released', dimColor: true },
    commits: release.merges.map(shortSubject),
    warning: release.behind ? `${release.behind} on ${BASE}, not on ${RELEASE}` : undefined,
    isYou: branch === RELEASE,
  }
}

function workLane(branch: string, work: NonNullable<Snapshot['work']>, depth: number): Lane {
  const lane = { name: branch, color: 'blue', depth, isYou: true }
  if (work.isMerged) return { ...lane, note: { text: `merged into ${work.parent}`, color: 'green' }, hint: `switch to ${work.parent} and pull` }
  return {
    ...lane,
    note: { text: work.ahead ? commitCount(work.ahead) : 'no commits yet', dimColor: true },
    commits: work.commits,
    total: work.ahead,
    warning: work.behind ? `${work.parent} has ${work.behind} new, pull it` : undefined,
  }
}

function lanesOf({ branch, release, work, others = [] }: Snapshot): Lane[] {
  const depth = release ? 2 : 1
  const open = others.map(o => ({ name: o.name, color: 'magenta', depth, note: { text: commitCount(o.ahead), dimColor: true }, commits: o.commits, total: o.ahead }))
  return [
    { name: BASE, color: 'green', depth: 0, isYou: branch === BASE },
    ...(release ? [releaseLane(release, branch)] : []),
    ...(work ? [workLane(branch, work, depth)] : []),
    ...open,
  ]
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'branch-status', description: 'Show where this branch stands against main' })
    void $.ui.open({ id: PANE, title: 'Git', columns: PANE_COLUMNS })
    void refresh($)
    $.clock.every(30_000, () => void refresh($))

    return next(e)
  })

  on('command.run', { command: 'branch-status' }, async $ => {
    await $.ui.open({ id: PANE, title: 'Git', columns: PANE_COLUMNS })
    await refresh($)

    return { text: 'Git panel opened.' }
  })

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const ran = await next(e)
    if (/\b(git|gh)\s/.test(e.command)) void refresh($)

    return ran
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const state = await read($, snapshot)
    if (state.error) return <Text dimColor>{state.error}</Text>
    if (!state.hasBase) return <Text dimColor>No {BASE} branch here.</Text>

    return (
      <Box flexDirection="column">
        {drawLanes(lanesOf(state)).map(({ lead, tail }) => (
          <Box>
            <Box flexShrink={0}><Text>{lead.map(({ text, ...style }) => <Text {...style}>{text}</Text>)}</Text></Box>
            <Box flexShrink={1}><Text>{tail.map(({ text, ...style }) => <Text {...style}>{text}</Text>)}</Text></Box>
          </Box>
        ))}
      </Box>
    )
  })
}
