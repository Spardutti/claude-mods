import { expect, test } from 'claude-code/testing'

import { openCandidates, parseBranches } from './branches'

const REFS = 'feat/mine\t\nfeat/other\t[ahead 2]\nfeat/merged\t[gone]\ndevelop\t\nmain\t[behind 2]\nrelease/1.0\t\nlocal-only\t\n'

test('a branch is gone only when its upstream is gone', () => {
  expect(parseBranches(REFS).filter(b => b.isGone).map(b => b.name)).toEqual(['feat/merged'])
})

test('open branches skip yours, gone ones, long-lived ones and release branches', () => {
  expect(openCandidates(parseBranches(REFS), 'feat/mine', ['main', 'develop'])).toEqual(['feat/other', 'local-only'])
})
