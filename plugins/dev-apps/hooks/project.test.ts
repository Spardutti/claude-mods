import { expect, test } from 'claude-code/testing'

import { projectName } from './project'

test('a checkout is named after the folder that holds its .git', () => {
  expect(projectName('/home/me/projects/ultra-cruceros/ultra-cruceros/.git\n', '/x')).toBe('ultra-cruceros')
})

test('a worktree is named after its main checkout', () => {
  expect(projectName('/home/me/stealthmetrix/shadow-ui-components/.git', '/home/me/shadow-ui-docs-v2')).toBe('shadow-ui-components')
})

test('outside git, the folder name is used', () => {
  expect(projectName(undefined, '/home/me/projects/acomer/')).toBe('acomer')
})
