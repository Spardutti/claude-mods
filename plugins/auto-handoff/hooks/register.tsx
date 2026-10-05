import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import type { Notice } from '../types'
import { handoffPath, sessionName } from './handoff'

type Phase = 'idle' | 'writing' | 'busy'

const WARN_POINTS = 5
const COUNTDOWN_SECONDS = 10
const notice = atom({ plugin: 'auto-handoff', key: 'notice' } as const, null as Notice | null)

// Module state, not $.state: it must survive /clear, which keeps this module loaded.
let phase: Phase = 'idle'
let countdown: Timer | undefined

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
  await $.command.run({ command })
}

async function countDown($: EngineInterface, percent: number, threshold: number) {
  let secondsLeft = COUNTDOWN_SECONDS
  await show($, { percent, threshold, secondsLeft })
  countdown = $.clock.every(1000, () => {
    secondsLeft -= 1
    if (secondsLeft > 0) return void show($, { percent, threshold, secondsLeft })
    stopCountdown($)
    void start($, percent)
  })
}

async function resumeFresh($: EngineInterface, answer: string) {
  const path = handoffPath(answer)
  if (!path) return compact($)
  phase = 'busy'
  try {
    const name = sessionName(path, await $.fs.read(path))
    await $.command.run({ command: 'clear' })
    await $.command.run({ command: 'rename', args: name })
    await $.prompt.submit({ text: `Read ${path} and continue.`, asUser: true })
  } finally {
    phase = 'idle'
  }
}

async function checkUsage($: EngineInterface, threshold: number) {
  const percent = (await $.session.usage()).context.percent ?? 0
  if (percent >= threshold) return countDown($, percent, threshold)
  await show($, percent >= threshold - WARN_POINTS ? { percent, threshold } : null)
}

export const register: Register = (on, options) => {
  const threshold = Number(options.threshold)

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    if (e.agentId || phase === 'busy') return done

    if (phase === 'writing') {
      if (e.reason === 'answer') void resumeFresh($, e.answer)
      else phase = 'idle'
      return done
    }

    if (e.reason === 'answer') await checkUsage($, threshold)
    return done
  })

  // A message sent during the countdown wins; the countdown starts again when that reply ends.
  on('prompt.submit', async ($, e, next) => {
    stopCountdown($)
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const shown = await read($, notice)
    if (e.props.hasSurvey || !shown) return next(e)
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
  })
}
