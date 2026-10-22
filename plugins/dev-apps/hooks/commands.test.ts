import { expect, test } from 'claude-code/testing'

import { lastError, startCommands, stopCommand } from './commands'

const script = (argv: string[] | undefined) => argv?.[4] ?? ''

test('a docker project with develop.watch stops the watch already in its folder, then starts compose watch', () => {
  const started = script(startCommands('shop', { kind: 'docker', watch: true })[0])
  const [kill, watch] = [started.indexOf('kill -TERM'), started.indexOf('exec docker compose watch')]
  expect([started.includes('readlink /proc/$p/cwd'), kill >= 0 && kill < watch, started.endsWith('exec docker compose watch')]).toEqual([true, true, true])
})

test('a docker watch start empties its log only after the old watch is gone', () => {
  const started = script(startCommands('shop', { kind: 'docker', watch: true })[0])
  expect(started.indexOf('kill -TERM') < started.indexOf('> "$HOME/.cache/dev-apps/$1"/docker.log')).toBe(true)
})

test('a docker project without develop.watch starts with compose up -d', () => {
  expect(script(startCommands('shop', { kind: 'docker', watch: false })[0]).endsWith('exec docker compose up -d')).toBe(true)
})

test('stopping a docker project kills the watch before compose down', () => {
  const stopped = script(stopCommand('shop', { kind: 'docker', watch: true }))
  const [kill, down] = [stopped.indexOf('kill -TERM'), stopped.indexOf('docker compose down')]
  expect([stopped.includes('watch.pid'), kill >= 0 && kill < down]).toEqual([false, true])
})

test('a docker project reads its error line from docker.log', () => {
  expect(lastError('shop', { kind: 'docker', watch: true }).slice(4)).toEqual(['shop', 'docker.log'])
})

test('a node project reads its error line from each script log', () => {
  expect(lastError('shop', { kind: 'node', manager: 'npm', scripts: ['dev', 'admin'] }).slice(4)).toEqual(['shop', 'dev.log', 'admin.log'])
})
