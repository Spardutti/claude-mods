import { expect, test } from 'claude-code/testing'

import { drawLanes, shortSubject } from './graph'

const asText = (rows: ReturnType<typeof drawLanes>) => rows.map(row => [...row.lead, ...row.tail].map(s => s.text).join('').trimEnd())

const MAIN = { name: 'main', color: 'green' }

test('each lane hangs off the one above, with its notes beneath it', () => {
  const rows = drawLanes([
    MAIN,
    { name: 'develop', color: 'yellow', note: { text: '3 to release' } },
    { name: 'feat/login', color: 'blue', note: { text: '2 commits' }, warning: 'develop has 3 new, pull it', isYou: true },
  ])
  expect(asText(rows)).toEqual([
    '● main',
    '└─● develop',
    '  │ 3 to release',
    '  └─● feat/login  ← you',
    '      2 commits',
    '      develop has 3 new, pull it',
  ])
})

test('the last lane has no line running down past its notes', () => {
  const rows = drawLanes([MAIN, { name: 'develop', color: 'yellow', note: { text: '5 to release' }, isYou: true }])
  expect(asText(rows)).toEqual(['● main', '└─● develop  ← you', '    5 to release'])
})

const SCREENSHOT = [
  MAIN,
  { name: 'develop', color: 'yellow', note: { text: '3 to release' } },
  { name: 'v1', color: 'blue', warning: 'develop has 3 new, pull it' },
]

test('the line down to a lane takes that lane color', () => {
  expect(drawLanes(SCREENSHOT)[2]?.lead[1]).toEqual({ text: '│ ', color: 'blue' })
})

test('a warning is red', () => {
  expect(drawLanes(SCREENSHOT)[4]?.tail).toEqual([{ text: 'develop has 3 new, pull it', color: 'red' }])
})

test('merge subjects shrink to the PR number and branch', () => {
  expect(shortSubject('Merge pull request #72 from acme/chore/back-merge-v0.7.0')).toBe('#72  chore/back-merge-v0.7.0')
  expect(shortSubject("Merge branch 'hotfix/x' into develop")).toBe('hotfix/x')
  expect(shortSubject('fix: typo')).toBe('fix: typo')
})
