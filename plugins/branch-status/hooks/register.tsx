import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Snapshot } from '../types'
import { parseCounts } from './counts'

const PANE = 'branch-status'
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

async function collect($: EngineInterface): Promise<Snapshot> {
  const branch = (await git($, ['rev-parse', '--abbrev-ref', 'HEAD']))?.trim()
  if (!branch) return { branch: '', error: 'Not a git repository.' }
  if (!(await hasRef($, BASE))) return { branch }

  const counts = parseCounts((await git($, ['rev-list', '--left-right', '--count', `${BASE}...HEAD`])) ?? '')
  const unreleased = (await hasRef($, RELEASE))
    ? (await git($, ['log', '--first-parent', '--format=%s', `${BASE}..${RELEASE}`]))?.split('\n').filter(Boolean)
    : undefined

  return { branch, ...counts, unreleased }
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

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'branch-status', description: 'Show where this branch stands against main' })
    void $.ui.open({ id: PANE, title: 'Git' })
    void refresh($)
    $.clock.every(30_000, () => void refresh($))

    return next(e)
  })

  on('command.run', { command: 'branch-status' }, async $ => {
    await $.ui.open({ id: PANE, title: 'Git' })
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

    const isOnBase = state.branch === BASE
    const isSynced = state.ahead === 0 && state.behind === 0

    return (
      <Box flexDirection="column">
        <Text bold>⎇ {state.branch}</Text>
        {state.ahead === undefined && <Text dimColor>No {BASE} branch here.</Text>}
        {state.ahead !== undefined && !isOnBase && (
          isSynced
            ? <Text color="green">Same as {BASE}</Text>
            : <Text>
                <Text color="green">↑{state.ahead} ahead</Text>  <Text color={state.behind ? 'red' : undefined}>↓{state.behind} behind</Text>
                <Text dimColor> {BASE}</Text>
              </Text>
        )}
        {state.unreleased && (
          <Text color={state.unreleased.length ? 'yellow' : 'green'}>
            {state.unreleased.length ? `${state.unreleased.length} on ${RELEASE}, not on ${BASE}` : `${RELEASE} is released`}
          </Text>
        )}
        {state.unreleased?.slice(0, 10).map(s => <Text dimColor wrap="truncate">  · {s}</Text>)}
      </Box>
    )
  })
}
