import { expect, test } from 'claude-code/testing'

import { browserApps } from './registry'

const REGISTRY = [
  '# port\tproject\tservice',
  '4321\tultra-cruceros\tweb',
  '4322\tultra-cruceros\tbackoffice',
  '4323\tultra-cruceros\tapi',
  '5470\tultra-cruceros\tpostgres',
  '6001\tshadow-ui-components\tstorybook-verify',
  '5185\tshadowsource\tweb',
  '',
].join('\n')

test('only the browser apps of the named project are listed', () => {
  expect(browserApps(REGISTRY, 'ultra-cruceros')).toEqual([
    { service: 'web', port: 4321 },
    { service: 'backoffice', port: 4322 },
  ])
})

test('a storybook service counts as a browser app', () => {
  expect(browserApps(REGISTRY, 'shadow-ui-components')).toEqual([{ service: 'storybook-verify', port: 6001 }])
})

test('a project with no rows lists nothing', () => {
  expect(browserApps(REGISTRY, 'claude-mods')).toEqual([])
})

test('a service that only starts with web is not a browser app', () => {
  expect(browserApps('3000\tx\twebhook\n', 'x')).toEqual([])
})

test('windows line endings are ignored', () => {
  expect(browserApps('3000\tx\tweb\r\n', 'x')).toEqual([{ service: 'web', port: 3000 }])
})
