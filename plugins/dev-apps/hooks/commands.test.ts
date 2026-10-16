import { expect, test } from 'claude-code/testing'

import { startCommands, stopCommand } from './commands'

const script = (argv: string[] | undefined) => argv?.[4] ?? ''

test('a docker project with develop.watch starts with compose watch and keeps its pid', () => {
  const started = script(startCommands('shop', { kind: 'docker', watch: true })[0])
  expect([started.includes('> "$HOME/.cache/dev-apps/$1"/watch.pid'), started.endsWith('exec docker compose watch')]).toEqual([true, true])
})

test('a docker project without develop.watch starts with compose up -d', () => {
  expect(script(startCommands('shop', { kind: 'docker', watch: false })[0]).endsWith('exec docker compose up -d')).toBe(true)
})

test('stopping a docker project kills the watch before compose down', () => {
  const stopped = script(stopCommand('shop', { kind: 'docker', watch: true }))
  const [kill, down] = [stopped.indexOf('kill -TERM'), stopped.indexOf('docker compose down')]
  expect(kill >= 0 && kill < down).toBe(true)
})
