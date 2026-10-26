import { expect, test } from 'claude-code/testing'

import { handoffFiles, handoffTitle } from './waiting'

const HOUR = 3_600_000
const NOW = 100 * 24 * HOUR
const file = (name: string, age: number) => ({ name, kind: 'file', mtimeMs: NOW - age })

test('a handoff of any age is a handoff file', () => {
  expect(handoffFiles([file('a.md', 0)]).map(e => e.name)).toEqual(['a.md'])
})

test('only markdown files count, newest first', () => {
  const entries = [file('old.md', 9 * HOUR), file('notes.txt', 2 * HOUR), { name: 'dir.md', kind: 'dir', mtimeMs: 0 }, file('new.md', 2 * HOUR)]
  expect(handoffFiles(entries).map(e => e.name)).toEqual(['new.md', 'old.md'])
})

test('the title comes from the handoff heading', () => {
  expect(handoffTitle('2026-10-02-login.md', '# Handoff — Fix the login redirect\n\nbody')).toBe('Fix the login redirect')
})

test('without a heading, the title is the file name minus its date', () => {
  expect(handoffTitle('2026-10-02-fix-login.md', 'no heading')).toBe('fix-login')
})
