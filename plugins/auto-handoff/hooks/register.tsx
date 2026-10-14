import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderInputOf, RenderSurface, Timer } from 'claude-code'

import type { Notice } from '../types'
import { handoffPath, sessionName } from './handoff'

type Phase = 'idle' | 'writing' | 'waiting' | 'busy'
type BandInput = { [S in RenderSurface]: RenderInputOf<'AbovePrompt', S> }[RenderSurface]

const WARN_POINTS = 5
const COUNTDOWN_SECONDS = 10
const LOOP_MARGIN = 10
const notice = atom({ plugin: 'auto-handoff', key: 'notice' } as const, null as Notice | null)

// Module state, not $.state: it must survive /clear, which keeps this module loaded.
let phase: Phase = 'idle'
let countdown: Timer | undefined
let startedAt = 0
let waitingPath = ''
let floor = 0
let floorPending = false
let hasBackgroundWork = false

const show = ($: EngineInterface, next: Notice | null) => update($, notice, () => next)

function stopCountdown($: EngineInterface) {
  if (!countdown) return
  countdown.cancel()
  countdown = undefined
  void show($, null)
}

async function findHandoffCommand($: EngineInterface) {
  const commands = await $.command.list()
  return commands.find(c => c.name === 'handoff' || c.name.endsWith(':handoff'))?.name
}

async function compact($: EngineInterface) {
  phase = 'busy'
  try {
    await $.command.run({ command: 'compact' })
  } finally {
    phase = 'idle'
  }
}

async function start($: EngineInterface, percent: number) {
  const command = await findHandoffCommand($)
  if (!command) {
    $.ui.toast(`Context at ${percent}%. Compacting.`)
    return compact($)
  }
  $.ui.toast(`Context at ${percent}%. Handing off to a fresh session.`)
  phase = 'writing'
  startedAt = await $.clock.now()
  await $.command.run({ command })
}

async function countDown($: EngineInterface, percent: number, threshold: number) {
  if (countdown) return
  let secondsLeft = COUNTDOWN_SECONDS
  await show($, { percent, threshold, secondsLeft })
  countdown = $.clock.every(1000, () => {
    secondsLeft -= 1
    if (secondsLeft > 0) return void show($, { percent, threshold, secondsLeft })
    stopCountdown($)
    void start($, percent)
  })
}

async function writtenHandoff($: EngineInterface, answer: string) {
  const path = handoffPath(answer)
  if (!path) return undefined
  const stat = await $.fs.stat(path).catch(() => undefined)
  return stat && stat.mtimeMs >= startedAt ? path : undefined
}

async function resumeFresh($: EngineInterface, path: string) {
  phase = 'busy'
  try {
    const name = sessionName(path, await $.fs.read(path))
    await $.command.run({ command: 'clear' })
    await $.command.run({ command: 'rename', args: name })
    floorPending = true
    await $.prompt.submit({ text: `Read ${path} and continue.`, asUser: true })
  } finally {
    phase = 'idle'
  }
}

async function askToFoldIn($: EngineInterface) {
  phase = 'writing'
  const text = `The background work finished. Add its results to ${waitingPath}, then reply with that path.`
  await $.prompt.submit({ text, asUser: true })
}

async function finishHandoff($: EngineInterface, answer: string, hasBackgroundWork: boolean) {
  if (phase === 'waiting') return hasBackgroundWork ? undefined : askToFoldIn($)
  const path = await writtenHandoff($, answer)
  if (!path) return compact($)
  if (!hasBackgroundWork) return resumeFresh($, path)
  phase = 'waiting'
  waitingPath = path
}

async function drawNotice($: EngineInterface, e: BandInput) {
  const shown = await read($, notice)
  if (e.props.hasSurvey || !shown) return undefined
  const { Box, Button, Text } = $.ui.resolve(e)
  if (shown.secondsLeft === undefined) {
    return <Text color="yellow">Context at {shown.percent}%. Handoff starts at {shown.threshold}%.</Text>
  }
  return (
    <Box>
      <Text color="yellow">Context at {shown.percent}%. Handing off in {shown.secondsLeft}s. </Text>
      <Button key="not-now" label="Not now" onPress={() => stopCountdown($)} />
    </Box>
  )
}

async function checkUsage($: EngineInterface, threshold: number) {
  const percent = (await $.session.usage()).context.percent ?? 0
  if (floorPending) floor = percent + LOOP_MARGIN
  else if (percent < floor - LOOP_MARGIN) floor = 0
  floorPending = false
  const at = Math.max(threshold, floor)
  if (percent >= at) return countDown($, percent, at)
  await show($, percent >= at - WARN_POINTS ? { percent, threshold: at } : null)
}

export const register: Register = (on, options) => {
  const threshold = Number(options.threshold)

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    if (e.agentId || phase === 'busy') return done

    if (phase !== 'idle') {
      if (e.reason === 'answer') void finishHandoff($, e.answer, hasBackgroundWork)
      else phase = 'idle'
      hasBackgroundWork = false
      return done
    }

    if (e.reason === 'answer') await checkUsage($, threshold)
    return done
  })

  // Only Stop lists running background tasks, and it ends before turn.complete, which acts on them.
  on('classic.Stop', async ($, e, next) => {
    hasBackgroundWork = (e.background_tasks?.length ?? 0) > 0
    return next(e)
  })

  // A message sent during the countdown wins; the countdown starts again when that reply ends.
  on('prompt.submit', async ($, e, next) => {
    stopCountdown($)
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => (await drawNotice($, e)) ?? next(e))
}
