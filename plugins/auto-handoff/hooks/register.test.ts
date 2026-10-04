import { expect, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

const PATH = '.claude/handoffs/2026-10-04-fix-login.md'
const WRITTEN = `Handoff written: ${PATH}\n\nNext session, paste:\n  Read ${PATH} and continue.`

// The test runtime has timers; the mod's type roots leave them out.
declare function setTimeout(run: () => void, ms: number): unknown

type Fake = { percent: number; commands: string[] }
type Seen = { ran: string[]; prompts: string[] }

type Engine = Parameters<TestBody>[0]
type On = Parameters<TestBody>[1]

function fakeSession(on: On, fake: Fake): Seen {
  const seen: Seen = { ran: [], prompts: [] }
  on('turn.complete', async (_, e) => ({ text: e.answer }))
  on('session.usage', async () => ({ value: { startedAt: 0, rateLimits: [], context: { window: 1_000_000, percent: fake.percent } } }))
  on('command.list', async () => ({ value: fake.commands.map(name => ({ name, description: '', source: 'user' as const })) }))
  on('command.run', async (_, e) => {
    seen.ran.push(e.args ? `${e.command} ${e.args}` : e.command)
    return {}
  })
  on('fs.read', async () => ({ value: '# Handoff — Fix the login redirect\n' }))
  on('prompt.submit', async (_, e) => {
    seen.prompts.push(e.text)
    return { text: e.text }
  })
  return seen
}

let turns = 0
async function endTurn($: Engine, fields: { answer?: string; reason?: 'answer' | 'aborted'; agentId?: string } = {}) {
  turns += 1
  const reason = fields.reason ?? 'answer'
  await $.turn.complete({ answer: fields.answer ?? 'ok', durationMs: 1, isAborted: reason === 'aborted', turnId: `t${turns}`, reason, agentId: fields.agentId })
  await new Promise<void>(resolve => setTimeout(resolve, 0))
}

test('above the threshold, the handoff is written, then a fresh named session resumes from it', async ($, on) => {
  const seen = fakeSession(on, { percent: 61, commands: ['handoff'] })

  await endTurn($)
  await endTurn($, { answer: WRITTEN })

  expect(seen.ran).toEqual(['handoff', 'clear', 'rename Fix the login redirect'])
  expect(seen.prompts).toEqual([`Read ${PATH} and continue.`])
})

test('below the threshold nothing happens', async ($, on) => {
  const seen = fakeSession(on, { percent: 59, commands: ['handoff'] })

  await endTurn($)

  expect(seen).toEqual({ ran: [], prompts: [] })
})

test('a raised threshold setting holds the handoff back', { options: { threshold: 80 } }, async ($, on) => {
  const seen = fakeSession(on, { percent: 70, commands: ['handoff'] })

  await endTurn($)

  expect(seen.ran).toEqual([])
})

test('without a handoff command, the session compacts', async ($, on) => {
  const seen = fakeSession(on, { percent: 61, commands: ['review'] })

  await endTurn($)

  expect(seen.ran).toEqual(['compact'])
})

test('when the handoff skill writes no file, the session compacts instead of clearing', async ($, on) => {
  const seen = fakeSession(on, { percent: 61, commands: ['handoff'] })

  await endTurn($)
  await endTurn($, { answer: "I didn't write a handoff file." })

  expect(seen.ran).toEqual(['handoff', 'compact'])
})

for (const [name, fields] of [
  ['a subagent turn', { agentId: 'agent-1' }],
  ['an interrupted turn', { reason: 'aborted' }],
] as const) {
  test(`${name} never starts a handoff`, async ($, on) => {
    const seen = fakeSession(on, { percent: 90, commands: ['handoff'] })

    await endTurn($, fields)

    expect(seen.ran).toEqual([])
  })
}
