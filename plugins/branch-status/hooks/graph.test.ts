import { expect, test } from 'claude-code/testing'

import { drawLanes, shortSubject } from './graph'

const asText = (rows: ReturnType<typeof drawLanes>) => rows.map(row => [...row.lead, ...row.tail].map(s => s.text).join('').trimEnd())

test('each lane forks off the last commit of the lane above', () => {
  const rows = drawLanes([
    { name: 'main', color: 'green' },
    { name: 'develop', color: 'yellow', commits: 3 },
    { name: 'feat/login', color: 'blue', commits: 2, isYou: true },
  ])
  expect(asText(rows)).toEqual([
    'main        ●──────────',
    '             ╲',
    'develop       ●─●─●',
    '                   ╲',
    'feat/login          ●─●    ←\u00A0you',
  ])
})

test('long runs of commits are cut short', () => {
  const [, , row] = asText(drawLanes([{ name: 'main', color: 'green' }, { name: 'develop', color: 'yellow', commits: 9 }]))
  expect(row).toBe('develop       ●─●─●─●┄')
})

test('a branch name too long for its label is shown whole beneath it', () => {
  const rows = asText(drawLanes([{ name: 'main', color: 'green' }, { name: 'feat/search-autocomplete', color: 'blue', commits: 1 }]))
  expect(rows.slice(2)).toEqual(['feat/searc…   ●', '              feat/search-autocomplete'])
})

test('merge subjects shrink to the PR number and branch', () => {
  expect(shortSubject('Merge pull request #72 from acme/chore/back-merge-v0.7.0')).toBe('#72  chore/back-merge-v0.7.0')
  expect(shortSubject("Merge branch 'hotfix/x' into develop")).toBe('hotfix/x')
  expect(shortSubject('fix: typo')).toBe('fix: typo')
})
