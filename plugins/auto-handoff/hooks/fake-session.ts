import { mock } from 'claude-code/testing'
import type { RenderElement } from 'claude-code'
import type { TestBody } from 'claude-code/testing'

export const COUNTDOWN_MS = 10_000
export const PATH = '.claude/handoffs/2026-10-04-fix-login.md'
export const WRITTEN = `Handoff written: ${PATH}\n\nNext session, paste:\n  Read ${PATH} and continue.`

// The test runtime has timers; the mod's type roots leave them out.
declare function setTimeout(run: () => void, ms: number): unknown

export type Engine = Parameters<TestBody>[0]
type On = Parameters<TestBody>[1]
type Fake = { percent: number; commands: string[]; handoffAgeMs?: number }
export type Seen = { ran: string[]; prompts: string[]; wait: (ms: number) => Promise<void> }
type TurnFields = { answer?: string; reason?: 'answer' | 'aborted'; agentId?: string; backgroundTasks?: number }

export function fakeSession(on: On, fake: Fake): Seen {
  const clock = mock.clock(on, { now: 1_000_000 })
  const seen: Seen = { ran: [], prompts: [], wait: ms => clock.advance(ms) }
  on('turn.complete', async (_, e) => ({ text: e.answer }))
  on('classic.Stop', async () => ({}))
  on('session.usage', async () => ({ value: { startedAt: 0, rateLimits: [], context: { window: 1_000_000, percent: fake.percent } } }))
  on('command.list', async () => ({ value: fake.commands.map(name => ({ name, description: '', source: 'user' as const })) }))
  on('command.run', async (_, e) => {
    seen.ran.push(e.args ? `${e.command} ${e.args}` : e.command)
    return {}
  })
  on('ui.render', async ($, e) => h($.ui.resolve(e).Text, {}, 'engine band') as RenderElement)
  on('fs.read', async () => ({ value: '# Handoff — Fix the login redirect\n' }))
  on('fs.stat', async () => ({ value: { kind: 'file' as const, size: 1, mtimeMs: clock.now() - (fake.handoffAgeMs ?? 0), isLink: false } }))
  on('prompt.submit', async (_, e) => {
    seen.prompts.push(e.text)
    return { text: e.text }
  })
  return seen
}

const runningTasks = (count: number) =>
  Array.from({ length: count }, (_, i) => ({ id: `task-${i}`, type: 'shell', status: 'running', description: 'npm test' }))

let turns = 0
export async function endTurn($: Engine, fields: TurnFields = {}) {
  turns += 1
  const reason = fields.reason ?? 'answer'
  const answer = fields.answer ?? 'ok'
  if (reason === 'answer' && !fields.agentId) {
    const background_tasks = runningTasks(fields.backgroundTasks ?? 0)
    await $.classic.Stop({ session_id: 's', transcript_path: '', cwd: '', stop_hook_active: false, last_assistant_message: answer, background_tasks })
  }
  await $.turn.complete({ answer, durationMs: 1, isAborted: reason === 'aborted', turnId: `t${turns}`, reason, agentId: fields.agentId })
  await new Promise<void>(resolve => setTimeout(resolve, 0))
}
