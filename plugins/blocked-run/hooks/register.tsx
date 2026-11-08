import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderInput } from 'claude-code'

import type { Blocked } from '../types'
import { askedCommandsOf } from './asked'
import { afterBlock, afterReply, afterRun, afterSend, lastLineOf, sentNote, skipRest } from './queue'

const blocked = atom({ plugin: 'blocked-run', key: 'blocked' } as const, null as Blocked | null)

let cwd: string | undefined

const commandOf = (input: unknown) =>
  typeof input === 'object' && input !== null && 'command' in input && typeof input.command === 'string' ? input.command : undefined

async function streamRun($: EngineInterface, command: string) {
  const child = $.process.spawn({ argv: ['bash', '-c', command], cwd })
  let output = ''
  let step = await child.next()
  while (!step.done) {
    output += step.value.text
    await update($, blocked, b => b && { ...b, lastLine: lastLineOf(output) })
    step = await child.next()
  }
  return { exitCode: step.value.code ?? -1, output }
}

// Not awaited by the button: a press gets 10s, and a deploy runs for minutes.
async function runIt($: EngineInterface, shown: Blocked) {
  await update($, blocked, b => b && { ...b, status: 'running' })
  const { exitCode, output } = await streamRun($, shown.command).catch(err => ({ exitCode: -1, output: String(err) }))
  await update($, blocked, b => b && afterRun(b, exitCode, output))
}

type Elements = ReturnType<EngineInterface['ui']['resolve']>

const labelOf = ({ Text }: Elements, text: string, color: string) => <Text backgroundColor={color} color="black" bold>{` ${text} `}</Text>

function waitingBand($: EngineInterface, el: Elements, shown: Blocked) {
  const { Box, Button, Text } = el
  const title = shown.asked ? labelOf(el, 'CLAUDE ASKS YOU TO RUN', 'magenta') : labelOf(el, 'AUTO MODE BLOCKED', 'yellow')
  const more = shown.queue?.length ? <Text dimColor>{` (then ${shown.queue.length} more)`}</Text> : null
  return (
    <Box flexDirection="column">
      <Text>{title} <Text bold>{shown.command}</Text>{more}</Text>
      <Box>
        <Button key="run" label="Run it myself" onPress={() => void runIt($, shown)} />
        <Text> </Text>
        <Button key="dismiss" label={shown.note ? 'Skip the rest' : 'Dismiss'} onPress={() => update($, blocked, skipRest)} />
      </Box>
    </Box>
  )
}

function band($: EngineInterface, e: RenderInput<'AbovePrompt'>, shown: Blocked) {
  const el = $.ui.resolve(e)
  const { Box, Button, Text } = el
  const label = (text: string, color: string) => labelOf(el, text, color)
  if (shown.status === 'waiting') return waitingBand($, el, shown)
  if (shown.status === 'running') {
    return <Text>{label('RUNNING', 'cyan')} <Text dimColor>{shown.lastLine || shown.command}</Text></Text>
  }
  const isOk = shown.exitCode === 0
  return (
    <Box flexDirection="column">
      <Text>{label(isOk ? 'DONE' : `FAILED (exit ${shown.exitCode})`, isOk ? 'green' : 'red')} <Text dimColor>{shown.lastLine}</Text></Text>
      <Box>
        <Text>Claude sees the output with your next message. </Text>
        <Button key="dismiss" label="Dismiss" onPress={() => update($, blocked, () => null)} />
      </Box>
    </Box>
  )
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    cwd = e.cwd
    return next(e)
  })

  on('classic.PermissionDenied', async ($, e, next) => {
    const command = e.tool_name === 'Bash' ? commandOf(e.tool_input) : undefined
    if (command) {
      await update($, blocked, b => afterBlock(b, command))
      $.ui.toast('Auto mode blocked a command. Run it yourself from above the prompt.')
    }
    return next(e)
  })

  on('classic.Stop', async ($, e, next) => {
    const commands = askedCommandsOf(e.last_assistant_message ?? '')
    await update($, blocked, b => afterReply(b, commands))
    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    const current = await read($, blocked)
    if (!current?.note) return next(e)
    const context = [...(e.context ?? []), sentNote(current)]
    await update($, blocked, b => b && afterSend(b))
    return next({ ...e, context })
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const shown = await read($, blocked)
    return e.props.hasSurvey || !shown ? next(e) : band($, e, shown)
  })
}
