import type { EngineInterface, Register } from 'claude-code'

import { handoffPath, sessionName } from './handoff'

type Phase = 'idle' | 'writing' | 'busy'

// Module state, not $.state: it must survive /clear, which keeps this module loaded.
let phase: Phase = 'idle'

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

    if (e.reason !== 'answer') return done
    const percent = (await $.session.usage()).context.percent ?? 0
    if (percent >= threshold) void start($, percent)
    return done
  })
}
