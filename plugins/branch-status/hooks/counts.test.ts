import { expect, test } from 'claude-code/testing'

import { parseCounts } from './counts'

test('rev-list counts read as behind then ahead', () => {
  expect(parseCounts('3\t5\n')).toEqual({ behind: 3, ahead: 5 })
  expect(parseCounts('')).toBeUndefined()
})
