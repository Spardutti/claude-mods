import type { Launcher } from '../types'

export const COMPOSE_FILES = ['compose.yaml', 'compose.yml', 'docker-compose.yaml', 'docker-compose.yml']

const LOCKS: [string, string][] = [['pnpm-lock.yaml', 'pnpm'], ['bun.lock', 'bun'], ['bun.lockb', 'bun'], ['yarn.lock', 'yarn']]

export type Sources = { compose?: string; env?: string; pkg?: string; files: string[] }

export function envOf(text = ''): Record<string, string> {
  const pairs = text.split('\n').map(line => /^\s*(?:export\s+)?(\w+)=["']?([^"'\r]*)["']?\s*$/.exec(line))
  return Object.fromEntries(pairs.filter(m => m !== null).map(m => [m[1], m[2]]))
}

// ${VAR}, ${VAR:-default} and ${VAR-default}, as compose fills them from .env.
const fill = (text: string, env: Record<string, string>) =>
  text.replace(/\$\{(\w+)(?::?-([^}]*))?\}/g, (_, name: string, fallback = '') => env[name] ?? fallback)

// "8080:80", "127.0.0.1:8080:80" or "8080:80/tcp": the host port is the one before the container's.
const HOST_PORT = /^-\s*["']?(?:[\d.]+:)?(\d+):\d+(?:\/\w+)?["']?\s*$/

export function composePorts(yaml: string, env: Record<string, string>): number[] {
  return fill(yaml, env)
    .split('\n')
    .map(line => HOST_PORT.exec(line.trim()))
    .filter(m => m !== null)
    .map(m => Number(m[1]))
}

export function scriptsFor(pkg: string, ports: number[]): string[] {
  const scripts: Record<string, string> = JSON.parse(pkg).scripts ?? {}
  const names = Object.keys(scripts).sort((a, b) => Number(b === 'dev') - Number(a === 'dev'))
  return ports
    .map(port => names.find(name => new RegExp(`(^|\\D)${port}(\\D|$)`).test(scripts[name] ?? '')))
    .filter(name => name !== undefined)
}

const WATCH = /^\s*develop:\s*\n\s*watch:/m

export const managerOf = (files: string[]) => LOCKS.find(([lock]) => files.includes(lock))?.[1] ?? 'npm'

export function launcherFor(sources: Sources, ports: number[]): Launcher | undefined {
  const { compose, env, pkg, files } = sources
  if (compose && composePorts(compose, envOf(env)).some(port => ports.includes(port))) return { kind: 'docker', watch: WATCH.test(compose) }
  const scripts = pkg ? [...new Set(scriptsFor(pkg, ports))] : []
  return scripts.length ? { kind: 'node', manager: managerOf(files), scripts } : undefined
}
