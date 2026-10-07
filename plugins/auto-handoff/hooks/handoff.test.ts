import { expect, test } from 'claude-code/testing'

import { handoffPath, sessionName } from './handoff'

const PATH = '.claude/handoffs/2026-10-04-fix-login.md'

test('the handoff path is read from the skill answer, with or without backticks', () => {
  expect(handoffPath(`Handoff written: ${PATH}\n\nNext session, paste:`)).toBe(PATH)
  expect(handoffPath(`Handoff written: \`${PATH}\``)).toBe(PATH)
})

test('a handoff name with dots in it is read whole', () => {
  const dotted = '.claude/handoffs/2026-10-07-v9.3.0-rollout.md'
  expect(handoffPath(`Handoff written: ${dotted}\n\nNext session, paste:`)).toBe(dotted)
})

test('an answer without a written handoff gives no path', () => {
  expect(handoffPath("I didn't write a handoff file.")).toBeUndefined()
})

test('a path outside .claude/handoffs is refused', () => {
  expect(handoffPath('Handoff written: ../../etc/secrets.md')).toBeUndefined()
  expect(handoffPath('Handoff written: .claude/handoffs/../../x.md')).toBeUndefined()
})

test('the session is named after the handoff subject', () => {
  expect(sessionName(PATH, '# Handoff — Fix the login redirect\n\n## Mission')).toBe('Fix the login redirect')
})

test('a handoff without a subject line is named after its file', () => {
  expect(sessionName(PATH, '## Mission\nSomething')).toBe('fix-login')
})
