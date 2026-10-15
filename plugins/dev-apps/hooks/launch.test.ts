import { expect, test } from 'claude-code/testing'

import { composePorts, envOf, launcherFor, managerOf, scriptsFor } from './launch'

const COMPOSE = [
  'services:',
  '  db:',
  '    ports:',
  '      - "5470:5432"',
  '    volumes:',
  '      - ./db:/var/lib/postgresql/data',
  '  web:',
  '    ports:',
  '      - "${WEB_PORT}:4321"',
  '  docs:',
  '    ports:',
  '      - 127.0.0.1:8080:4180',
  '  admin:',
  '    ports:',
  '      - "${ADMIN_PORT:-4330}:80/tcp"',
].join('\n')

test('compose host ports are read, with .env values filled in and volumes skipped', () => {
  expect(composePorts(COMPOSE, { WEB_PORT: '4321' })).toEqual([5470, 4321, 8080, 4330])
})

test('a .env value wins over the compose default', () => {
  expect(composePorts('- "${ADMIN_PORT:-4330}:80"', { ADMIN_PORT: '4400' })).toEqual([4400])
})

test('.env lines are read with quotes and export stripped, comments skipped', () => {
  expect(envOf('# ports\nWEB_PORT=4321\nexport API_PORT="4323"\r\n')).toEqual({ WEB_PORT: '4321', API_PORT: '4323' })
})

test('the dev script is picked when two scripts name the port', () => {
  const pkg = JSON.stringify({ scripts: { start: 'next start -p 3333', dev: 'next dev -p 3333' } })
  expect(scriptsFor(pkg, [3333])).toEqual(['dev'])
})

test('a script naming a longer port does not match', () => {
  const pkg = JSON.stringify({ scripts: { dev: 'vite --port 51850' } })
  expect(scriptsFor(pkg, [5185])).toEqual([])
})

const LOCKS = [
  { files: ['pnpm-lock.yaml'], manager: 'pnpm' },
  { files: ['bun.lockb'], manager: 'bun' },
  { files: ['bun.lock'], manager: 'bun' },
  { files: ['yarn.lock'], manager: 'yarn' },
  { files: ['package-lock.json'], manager: 'npm' },
  { files: [], manager: 'npm' },
]

for (const { files, manager } of LOCKS) {
  test(`${files[0] ?? 'no lock file'} picks ${manager}`, () => {
    expect(managerOf(files)).toBe(manager)
  })
}

test('a compose file that maps an app port wins over package.json', () => {
  const sources = { compose: '- "3333:3333"', pkg: JSON.stringify({ scripts: { dev: 'next dev -p 3333' } }), files: [] }
  expect(launcherFor(sources, [3333])).toEqual({ kind: 'docker' })
})

test('without a matching compose port, the package.json script is used', () => {
  const sources = { compose: '- "8080:4180"', pkg: JSON.stringify({ scripts: { storybook: 'storybook dev -p 5555' } }), files: ['pnpm-lock.yaml'] }
  expect(launcherFor(sources, [5555])).toEqual({ kind: 'node', manager: 'pnpm', scripts: ['storybook'] })
})

test('two apps served by one script start it once', () => {
  const sources = { pkg: JSON.stringify({ scripts: { dev: 'run-p "vite --port 5173" "vite --port 5174"' } }), files: [] }
  expect(launcherFor(sources, [5173, 5174])).toEqual({ kind: 'node', manager: 'npm', scripts: ['dev'] })
})

test('a port no file names has no way to start', () => {
  expect(launcherFor({ compose: '- "8080:4180"', pkg: '{"scripts":{}}', files: [] }, [6001])).toBeUndefined()
})
