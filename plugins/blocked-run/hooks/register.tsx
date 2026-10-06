import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderInput } from 'claude-code'

import type { Blocked } from '../types'

const MAX_OUTPUT = 4000
const blocked = atom({ plugin: 'blocked-run', key: 'blocked' } as const, null as Blocked | null)

let cwd: string | undefined

const commandOf = (input: unknown) =>
  typeof input === 'object' && input !== null && 'command' in input && typeof input.command === 'string' ? input.command : undefined

const lastLineOf = (output: string) => output.trimEnd().split('\n').pop() ?? ''

function noteFor(command: string, exitCode: number, output: string) {
  const tail = output.length > MAX_OUTPUT ? `...${output.slice(-MAX_OUTPUT)}` : output
  return `Auto mode blocked this command, so the user ran it themselves:\n$ ${command}\nExit code ${exitCode}.\nOutput:\n${tail || '(none)'}`
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

// Not awaited by the button: a press gets 10s, and a deploy runs for minutes.
async function runIt($: EngineInterface, command: string) {
  await update($, blocked, () => ({ command, status: 'running' }))
  const { exitCode, output } = await streamRun($, command).catch(err => ({ exitCode: -1, output: String(err) }))
  const note = noteFor(command, exitCode, output)
  await update($, blocked, () => ({ command, status: 'done' as const, exitCode, lastLine: lastLineOf(output), note }))
}

function band($: EngineInterface, e: RenderInput<'AbovePrompt'>, shown: Blocked) {
  const { Box, Button, Text } = $.ui.resolve(e)
  const label = (text: string, color: string) => <Text backgroundColor={color} color="black" bold>{` ${text} `}</Text>
  const dismiss = <Button key="dismiss" label="Dismiss" onPress={() => update($, blocked, () => null)} />
  if (shown.status === 'waiting') {
    return (
      <Box flexDirection="column">
        <Text>{label('AUTO MODE BLOCKED', 'yellow')} <Text bold>{shown.command}</Text></Text>
        <Box>
          <Button key="run" label="Run it myself" onPress={() => void runIt($, shown.command)} />
          <Text> </Text>
          {dismiss}
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
