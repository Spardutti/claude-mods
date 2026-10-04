import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Snapshot } from '../types'
import { parseCounts } from './counts'
import { drawLanes, shortSubject } from './graph'
import type { Lane } from './graph'

const PANE = 'branch-status'
const PANE_COLUMNS = 56
const BASE = 'main'
const RELEASE = 'develop'
const snapshot = atom({ plugin: 'branch-status', key: 'snapshot' } as const, { branch: '' } as Snapshot)

let isRefreshing = false

async function git($: EngineInterface, args: string[]) {
  const { exitCode, stdout } = await $.process.run(['git', ...args])
  return exitCode === 0 ? stdout : undefined
}

async function hasRef($: EngineInterface, ref: string) {
  return (await git($, ['rev-parse', '--verify', '-q', ref])) !== undefined
}

async function drift($: EngineInterface, from: string, to: string) {
  return parseCounts((await git($, ['rev-list', '--no-merges', '--left-right', '--count', `${from}...${to}`])) ?? '') ?? { ahead: 0, behind: 0 }
}

// A merge whose side branch holds no commits missing from base (a sync from main) has nothing to release.
async function bringsWork($: EngineInterface, base: string, hash: string) {
  return (await git($, ['rev-list', '--no-merges', '--count', `${base}..${hash}^2`]))?.trim() !== '0'
}

async function unreleased($: EngineInterface, base: string, ref: string) {
  const lines = ((await git($, ['log', '--first-parent', '--format=%H %s', `${base}..${ref}`])) ?? '').split('\n').filter(Boolean)
  const kept: string[] = []
  for (const line of lines) {
    const [hash = '', ...subject] = line.split(' ')
    if (await bringsWork($, base, hash)) kept.push(subject.join(' '))
  }
  return kept
}

// Branches other than yours are read from origin, since local copies of them go stale.
async function refOf($: EngineInterface, name: string, branch: string) {
  return name !== branch && (await hasRef($, `origin/${name}`)) ? `origin/${name}` : name
}

async function collect($: EngineInterface): Promise<Snapshot> {
  const branch = (await git($, ['rev-parse', '--abbrev-ref', 'HEAD']))?.trim()
  if (!branch) return { branch: '', error: 'Not a git repository.' }
  if (!(await hasRef($, BASE))) return { branch, hasBase: false }

  const base = await refOf($, BASE, branch)
  const hasRelease = await hasRef($, RELEASE)
  const releaseRef = hasRelease ? await refOf($, RELEASE, branch) : RELEASE
  const release = hasRelease
    ? {
        ...(await drift($, base, releaseRef)),
        merges: await unreleased($, base, releaseRef),
      }
    : undefined
  const parent = hasRelease ? RELEASE : BASE
  const work = branch === BASE || branch === RELEASE ? undefined : { parent, ...(await drift($, hasRelease ? releaseRef : base, 'HEAD')) }

  return { branch, hasBase: true, release, work }
}

async function refresh($: EngineInterface) {
  if (isRefreshing) return
  isRefreshing = true
  try {
    const next = await collect($)
    await update($, snapshot, () => next)
  } finally {
    isRefreshing = false
  }
}

function lanesOf({ branch, release, work }: Snapshot): Lane[] {
  const lanes: Lane[] = [{ name: BASE, color: 'green', isYou: branch === BASE }]
  if (release) {
    lanes.push({
      name: RELEASE,
      color: 'yellow',
      commits: release.merges.length,
      note: release.merges.length ? { text: `${release.merges.length} to release`, color: 'yellow' } : { text: 'all released', dimColor: true },
      warning: release.behind ? `${release.behind} on ${BASE}, not on ${RELEASE}` : undefined,
      isYou: branch === RELEASE,
    })
  }
  if (work) {
    lanes.push({
      name: branch,
      color: 'blue',
      commits: work.ahead,
      note: { text: work.ahead ? `${work.ahead} commit${work.ahead === 1 ? '' : 's'}` : 'no commits yet', dimColor: true },
      warning: work.behind ? `${work.parent} has ${work.behind} new, pull it` : undefined,
      isYou: true,
    })
  }
  return lanes
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

    const merges = state.release?.merges ?? []

    return (
      <Box flexDirection="column">
        {drawLanes(lanesOf(state)).map(({ lead, tail }) => (
          <Box>
            <Box flexShrink={0}><Text>{lead.map(({ text, ...style }) => <Text {...style}>{text}</Text>)}</Text></Box>
            <Box flexShrink={1}><Text>{tail.map(({ text, ...style }) => <Text {...style}>{text}</Text>)}</Text></Box>
          </Box>
        ))}
        {merges.length > 0 && <Text> </Text>}
        {merges.slice(0, 10).map(s => (
          <Box>
            <Box flexShrink={0}><Text dimColor>  · </Text></Box>
            <Box flexShrink={1}><Text dimColor>{shortSubject(s)}</Text></Box>
          </Box>
        ))}
      </Box>
    )
  })
}
