import { expect, test } from 'claude-code/testing'

import { ageOf, handoffTitle, waitingFiles } from './waiting'

const HOUR = 3_600_000
const NOW = 100 * 24 * HOUR
const file = (name: string, age: number) => ({ name, kind: 'file', mtimeMs: NOW - age })

test('a handoff exactly an hour old is waiting', () => {
  expect(waitingFiles([file('a.md', HOUR)], NOW).map(e => e.name)).toEqual(['a.md'])
})

test('a handoff just under an hour old is not waiting yet', () => {
  expect(waitingFiles([file('a.md', HOUR - 1)], NOW)).toEqual([])
})

test('only markdown files count, newest first', () => {
  const entries = [file('old.md', 9 * HOUR), file('notes.txt', 2 * HOUR), { name: 'dir.md', kind: 'dir', mtimeMs: 0 }, file('new.md', 2 * HOUR)]
  expect(waitingFiles(entries, NOW).map(e => e.name)).toEqual(['new.md', 'old.md'])
})

test('the title comes from the handoff heading', () => {
  expect(handoffTitle('2026-10-02-login.md', '# Handoff — Fix the login redirect\n\nbody')).toBe('Fix the login redirect')
})

test('without a heading, the title is the file name minus its date', () => {
  expect(handoffTitle('2026-10-02-fix-login.md', 'no heading')).toBe('fix-login')
})

for (const [hours, expected] of [[2, 'today'], [24, 'yesterday'], [72, '3 days ago']] as const) {
  test(`a handoff ${hours} hours old reads ${expected}`, () => {
    expect(ageOf(NOW - hours * HOUR, NOW)).toBe(expected)
  })
}
