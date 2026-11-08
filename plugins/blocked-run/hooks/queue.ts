import type { Blocked, Pending } from '../types'

const MAX_OUTPUT = 4000

export const lastLineOf = (output: string) => output.trimEnd().split('\n').pop() ?? ''

const commandsOf = (queue: Pending[] = []) => queue.map(p => p.command)
const listNote = (why: string, commands: string[]) => (commands.length ? `${why}:\n${commands.map(c => `$ ${c}`).join('\n')}` : '')
const joinNotes = (...notes: (string | undefined)[]) => notes.filter(Boolean).join('\n\n')

function noteFor({ command, asked }: Blocked, exitCode: number, output: string) {
  const tail = output.length > MAX_OUTPUT ? `...${output.slice(-MAX_OUTPUT)}` : output
  const why = asked ? 'You asked the user to run this command, and they ran it' : 'Auto mode blocked this command, so the user ran it themselves'
  return `${why}:\n$ ${command}\nExit code ${exitCode}.\nOutput:\n${tail || '(none)'}`
}

function arrive(current: Blocked | null, items: Pending[]): Blocked | null {
  const [first, ...rest] = items
  if (!first) return current
  if (!current) return { ...first, status: 'waiting', queue: rest }
  if (current.status === 'done') return { ...first, status: 'waiting', queue: rest, note: current.note }
  return { ...current, queue: [...(current.queue ?? []), ...items] }
}

export const afterBlock = (current: Blocked | null, command: string) => arrive(current, [{ command }])

// An ask nobody ran is stale once Claude replies again: drop it, keep any blocked command queued behind it.
function dropStaleAsks(current: Blocked | null): Blocked | null {
  if (current?.status !== 'waiting' || !current.asked || current.note) return current
  const [first, ...rest] = (current.queue ?? []).filter(p => !p.asked)
  return first ? { ...first, status: 'waiting', queue: rest } : null
}

export const afterReply = (current: Blocked | null, commands: string[]) =>
  arrive(dropStaleAsks(current), commands.map(command => ({ command, asked: true })))

export function afterRun(b: Blocked, exitCode: number, output: string): Blocked {
  const note = joinNotes(b.note, noteFor(b, exitCode, output))
  const ran = { ...b, exitCode, lastLine: lastLineOf(output) }
  const [following, ...rest] = b.queue ?? []
  if (following && exitCode === 0) return { ...ran, command: following.command, asked: following.asked, queue: rest, status: 'waiting', note }
  return { ...ran, status: 'done', queue: [], note: joinNotes(note, listNote('Not run, because the command before it failed', commandsOf(b.queue))) }
}

export const skipRest = (b: Blocked | null): Blocked | null =>
  b?.note ? { ...b, status: 'done', queue: [], note: joinNotes(b.note, listNote('The user chose not to run', [b.command, ...commandsOf(b.queue)])) } : null

export function sentNote(b: Blocked) {
  const waiting = b.status === 'waiting' ? [b.command, ...commandsOf(b.queue)] : commandsOf(b.queue)
  const running = b.status === 'running' ? listNote('Still running', [b.command]) : ''
  return joinNotes(b.note, running, listNote('Not run yet, still waiting above the prompt', waiting))
}

export const afterSend = (b: Blocked): Blocked | null => (b.status === 'done' ? null : { ...b, note: undefined })
