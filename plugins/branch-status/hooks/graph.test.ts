import { expect, test } from 'claude-code/testing'

import { drawLanes, shortSubject } from './graph'
import type { Lane } from './graph'

const asText = (rows: ReturnType<typeof drawLanes>) => rows.map(row => [...row.lead, ...row.tail].map(s => s.text).join('').trimEnd())

const MAIN = { name: 'main', color: 'green', depth: 0 }
const DEVELOP = { name: 'develop', color: 'yellow', depth: 1 }
const commits = (count: number) => Array.from({ length: count }, (_, i) => `commit ${i + 1}`)

test('each lane hangs off the one above, with its notes beneath it', () => {
  const rows = drawLanes([
    MAIN,
    { ...DEVELOP, note: { text: '3 to release' } },
    { name: 'feat/login', color: 'blue', depth: 2, note: { text: '2 commits' }, warning: 'develop has 3 new, pull it', isYou: true },
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
  const rows = drawLanes([MAIN, { ...DEVELOP, note: { text: '5 to release' }, isYou: true }])
  expect(asText(rows)).toEqual(['● main', '└─● develop  ← you', '    5 to release'])
})

test('two branches off develop fork, and a line runs past the first to the second', () => {
  const rows = drawLanes([
    MAIN,
    DEVELOP,
    { name: 'feat/a', color: 'blue', depth: 2, commits: ['add a'] },
    { name: 'feat/b', color: 'magenta', depth: 2, commits: ['add b'] },
  ])
  expect(asText(rows)).toEqual(['● main', '└─● develop', '  ├─● feat/a', '  │   · add a', '  └─● feat/b', '      · add b'])
})

test('the line past a branch takes the color of the branch it leads to', () => {
  const lanes: Lane[] = [MAIN, DEVELOP, { name: 'feat/a', color: 'blue', depth: 2, note: { text: '1 commit' } }, { name: 'feat/b', color: 'magenta', depth: 2 }]
  expect(drawLanes(lanes)[3]?.lead[1]).toEqual({ text: '│ ', color: 'magenta' })
})

test('exactly five commits show with no more line', () => {
  const rows = asText(drawLanes([MAIN, { ...DEVELOP, commits: commits(5) }]))
  expect(rows.slice(2)).toEqual(['    · commit 1', '    · commit 2', '    · commit 3', '    · commit 4', '    · commit 5'])
})

test('a sixth commit becomes a more line', () => {
  const rows = asText(drawLanes([MAIN, { ...DEVELOP, commits: commits(6) }]))
  expect(rows.slice(-2)).toEqual(['    · commit 5', '    +1 more'])
})

test('a total larger than the commits read counts toward the more line', () => {
  const rows = asText(drawLanes([MAIN, { ...DEVELOP, commits: commits(5), total: 9 }]))
  expect(rows.at(-1)).toBe('    +4 more')
})

test('a hint is dimmed', () => {
  const rows = drawLanes([MAIN, { ...DEVELOP, note: { text: 'merged into develop' }, hint: 'switch to develop and pull' }])
  expect(rows[3]?.tail).toEqual([{ text: 'switch to develop and pull', dimColor: true }])
})

test('a warning is red', () => {
  const rows = drawLanes([MAIN, { ...DEVELOP, warning: '2 on main, not on develop' }])
  expect(rows[2]?.tail).toEqual([{ text: '2 on main, not on develop', color: 'red' }])
})

test('merge subjects shrink to the PR number and branch', () => {
  expect(shortSubject('Merge pull request #72 from acme/chore/back-merge-v0.7.0')).toBe('#72  chore/back-merge-v0.7.0')
  expect(shortSubject("Merge branch 'hotfix/x' into develop")).toBe('hotfix/x')
  expect(shortSubject('fix: typo')).toBe('fix: typo')
})
