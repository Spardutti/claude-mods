import { expect, test } from 'claude-code/testing'

import { handoffPath, resumePrompt, sessionName } from './handoff'

const PATH = '.claude/handoffs/2026-10-04-fix-login.md'

test('the handoff path is read from the skill answer, with or without backticks', () => {
  expect(handoffPath(`Handoff written: ${PATH}\n\nNext session, paste:`)).toBe(PATH)
  expect(handoffPath(`Handoff written: \`${PATH}\``)).toBe(PATH)
})

test('a handoff name with dots in it is read whole', () => {
  const dotted = '.claude/handoffs/2026-10-07-v9.3.0-rollout.md'
  expect(handoffPath(`Handoff written: ${dotted}\n\nNext session, paste:`)).toBe(dotted)
})

test('a reworded answer still gives the handoff path', () => {
  const answer = `I wrote the handoff: \`${PATH}\`\n\nThe tree is clean.\n\nNext session, paste:\n  Read ${PATH} and continue.`
  expect(handoffPath(answer)).toBe(PATH)
})

test('an answer without a written handoff gives no path', () => {
  expect(handoffPath("I didn't write a handoff file.")).toBeUndefined()
})

test('a path outside .claude/handoffs is refused', () => {
  expect(handoffPath('Handoff written: ../../etc/secrets.md')).toBeUndefined()
  expect(handoffPath('Handoff written: .claude/handoffs/../../x.md')).toBeUndefined()
})

test('with no reply and nothing running, the resume prompt only names the note', () => {
  expect(resumePrompt(PATH, [], [])).toBe(`Read ${PATH} and continue.`)
})

test('the resume prompt carries the replies the reset hid', () => {
  expect(resumePrompt(PATH, ['Go test the room.', `Handoff written: ${PATH}`], [])).toBe(
    `Read ${PATH} and continue.\n\n` +
      'The reset hid your last reply, below. Repeat to the user anything in it beyond the handoff path.\n\n' +
      `Go test the room.\n\nHandoff written: ${PATH}`,
  )
})

test('the resume prompt lists background tasks that may still report back', () => {
  expect(resumePrompt(PATH, [], ['Launch the game', 'Watch the logs'])).toBe(
    `Read ${PATH} and continue.\n\n` +
      "These background tasks started before the reset. When one reports back, that is not the user's answer:\n" +
      '- Launch the game\n- Watch the logs',
  )
})

test('the session is named after the handoff subject', () => {
  expect(sessionName(PATH, '# Handoff — Fix the login redirect\n\n## Mission')).toBe('Fix the login redirect')
})

test('a handoff without a subject line is named after its file', () => {
  expect(sessionName(PATH, '## Mission\nSomething')).toBe('fix-login')
})
