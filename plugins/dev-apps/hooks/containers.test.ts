import { expect, test } from 'claude-code/testing'

import { isAnyDown, isAnyUp, serviceNames, servicesOf } from './containers'

const row = (Service: string, State: string, more: { Health?: string; ExitCode?: number } = {}) =>
  JSON.stringify({ Service, State, Health: '', ExitCode: 0, ...more })

test('each compose service gets its state, in the order compose lists them', () => {
  const ps = [row('api', 'exited', { ExitCode: 1 }), row('db', 'running'), row('migrate', 'exited')].join('\n')

  expect(servicesOf(ps, ['web', 'db', 'migrate', 'api'])).toEqual([
    { name: 'web', state: 'stopped' },
    { name: 'db', state: 'running' },
    { name: 'migrate', state: 'exited' },
    { name: 'api', state: 'crashed', exitCode: 1 },
  ])
})

test('a container failing its health check is unhealthy, not running', () => {
  expect(servicesOf(row('db', 'running', { Health: 'unhealthy' }), ['db'])).toEqual([{ name: 'db', state: 'unhealthy' }])
})

test('a container still waiting on its health check is starting', () => {
  expect(servicesOf(row('db', 'running', { Health: 'starting' }), ['db'])).toEqual([{ name: 'db', state: 'starting' }])
})

test('a container in a restart loop is restarting', () => {
  expect(servicesOf(row('api', 'restarting', { ExitCode: 1 }), ['api'])).toEqual([{ name: 'api', state: 'restarting' }])
})

test('the older array output reads the same as one object per line', () => {
  expect(servicesOf(`[${row('db', 'running')}]`, ['db'])).toEqual([{ name: 'db', state: 'running' }])
})

test('with no service list, the services come from the containers found', () => {
  expect(servicesOf([row('db', 'running'), row('db', 'running')].join('\n'), [])).toEqual([{ name: 'db', state: 'running' }])
})

test('output that is not JSON shows every listed service stopped', () => {
  expect(servicesOf('permission denied', ['db'])).toEqual([{ name: 'db', state: 'stopped' }])
})

for (const code of [0, 130, 137, 143]) {
  test(`exit code ${code} is a stop, not a crash`, () => {
    expect(servicesOf(row('db', 'exited', { ExitCode: code }), ['db'])).toEqual([{ name: 'db', state: 'exited' }])
  })
}

test('exit code 2 is a crash', () => {
  expect(servicesOf(row('db', 'exited', { ExitCode: 2 }), ['db'])).toEqual([{ name: 'db', state: 'crashed', exitCode: 2 }])
})

test('an old one-off run container does not hide the real one', () => {
  const oneOff = JSON.stringify({ Service: 'web', State: 'exited', ExitCode: 1, Labels: 'com.docker.compose.oneoff=True' })

  expect(servicesOf([oneOff, row('web', 'running')].join('\n'), ['web'])).toEqual([{ name: 'web', state: 'running' }])
})

test('a crashed container counts as down', () => {
  expect(isAnyDown([{ name: 'db', state: 'crashed', exitCode: 1 }])).toBe(true)
})

test('a restarting container counts as up', () => {
  expect(isAnyUp([{ name: 'api', state: 'restarting' }])).toBe(true)
})

test('a container that exited cleanly counts as neither up nor down', () => {
  expect([isAnyUp([{ name: 'migrate', state: 'exited' }]), isAnyDown([{ name: 'migrate', state: 'exited' }])]).toEqual([false, false])
})

test('one crashed replica shows the service crashed', () => {
  const ps = [row('worker', 'running'), row('worker', 'exited', { ExitCode: 1 })].join('\n')

  expect(servicesOf(ps, ['worker'])).toEqual([{ name: 'worker', state: 'crashed', exitCode: 1 }])
})

test('a stray line that is not JSON keeps the other containers', () => {
  expect(servicesOf(['a notice', row('db', 'running')].join('\n'), ['db'])).toEqual([{ name: 'db', state: 'running' }])
})

test('the service list drops blank lines', () => {
  expect(serviceNames('web\ndb\n\n')).toEqual(['web', 'db'])
})
