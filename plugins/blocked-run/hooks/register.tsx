import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderInput } from 'claude-code'

import type { Blocked } from '../types'
import { askedCommandsOf } from './asked'

const MAX_OUTPUT = 4000
const blocked = atom({ plugin: 'blocked-run', key: 'blocked' } as const, null as Blocked | null)

let cwd: string | undefined

const commandOf = (input: unknown) =>
  typeof input === 'object' && input !== null && 'command' in input && typeof input.command === 'string' ? input.command : undefined

const lastLineOf = (output: string) => output.trimEnd().split('\n').pop() ?? ''

function noteFor({ command, asked }: Blocked, exitCode: number, output: string) {
  const tail = output.length > MAX_OUTPUT ? `...${output.slice(-MAX_OUTPUT)}` : output
  const why = asked ? 'You asked the user to run this command, and they ran it' : 'Auto mode blocked this command, so the user ran it themselves'
  return `${why}:\n$ ${command}\nExit code ${exitCode}.\nOutput:\n${tail || '(none)'}`
}

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

const skippedNote = (why: string, commands: string[]) => (commands.length ? `${why}:\n${commands.map(c => `$ ${c}`).join('\n')}` : '')
const joinNotes = (...notes: (string | undefined)[]) => notes.filter(Boolean).join('\n\n')

const skipRest = (b: Blocked | null): Blocked | null =>
  b?.note ? { ...b, status: 'done', queue: [], note: joinNotes(b.note, skippedNote('The user chose not to run', [b.command, ...(b.queue ?? [])])) } : null

// Not awaited by the button: a press gets 10s, and a deploy runs for minutes.
async function runIt($: EngineInterface, shown: Blocked) {
  await update($, blocked, () => ({ ...shown, status: 'running' }))
  const { exitCode, output } = await streamRun($, shown.command).catch(err => ({ exitCode: -1, output: String(err) }))
  const note = joinNotes(shown.note, noteFor(shown, exitCode, output))
  const ran = { ...shown, exitCode, lastLine: lastLineOf(output) }
  const [following, ...rest] = shown.queue ?? []
  if (following && exitCode === 0) {
    await update($, blocked, () => ({ ...ran, command: following, queue: rest, status: 'waiting' as const, note }))
    return
  }
  const skipped = skippedNote('Not run, because the command before it failed', shown.queue ?? [])
  await update($, blocked, () => ({ ...ran, status: 'done' as const, queue: [], note: joinNotes(note, skipped) }))
}

function band($: EngineInterface, e: RenderInput<'AbovePrompt'>, shown: Blocked) {
  const { Box, Button, Text } = $.ui.resolve(e)
  const label = (text: string, color: string) => <Text backgroundColor={color} color="black" bold>{` ${text} `}</Text>
  const dismiss = <Button key="dismiss" label="Dismiss" onPress={() => update($, blocked, () => null)} />
  if (shown.status === 'waiting') {
    const more = shown.queue?.length ? <Text dimColor>{` (then ${shown.queue.length} more)`}</Text> : null
    const skip = <Button key="dismiss" label={shown.note ? 'Skip the rest' : 'Dismiss'} onPress={() => update($, blocked, skipRest)} />
    return (
      <Box flexDirection="column">
        <Text>{shown.asked ? label('CLAUDE ASKS YOU TO RUN', 'magenta') : label('AUTO MODE BLOCKED', 'yellow')} <Text bold>{shown.command}</Text>{more}</Text>
        <Box>
          <Button key="run" label="Run it myself" onPress={() => void runIt($, shown)} />
          <Text> </Text>
          {skip}
        </Box>
      </Box>
    )
  }
  if (shown.status === 'running') {
    return <Text>{label('RUNNING', 'cyan')} <Text dimColor>{shown.lastLine || shown.command}</Text></Text>
  }
  const isOk = shown.exitCode === 0
  return (
    <Box flexDirection="column">
      <Text>{label(isOk ? 'DONE' : `FAILED (exit ${shown.exitCode})`, isOk ? 'green' : 'red')} <Text dimColor>{shown.lastLine}</Text></Text>
      <Box>
        <Text>Claude sees the output with your next message. </Text>
        {dismiss}
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
      await update($, blocked, () => ({ command, status: 'waiting' }))
      $.ui.toast('Auto mode blocked a command. Run it yourself from above the prompt.')
    }
    return next(e)
  })

  on('classic.Stop', async ($, e, next) => {
    const [command, ...queue] = askedCommandsOf(e.last_assistant_message ?? '')
    const current = await read($, blocked)
    if (command && (!current || (current.status === 'waiting' && !current.note))) {
      await update($, blocked, () => ({ command, queue, status: 'waiting', asked: true }))
    }
    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    const note = (await read($, blocked))?.note
    if (!note) return next(e)
    const context = [...(e.context ?? []), note]
    await update($, blocked, () => null)
    return next({ ...e, context })
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const shown = await read($, blocked)
    return e.props.hasSurvey || !shown ? next(e) : band($, e, shown)
  })
}
