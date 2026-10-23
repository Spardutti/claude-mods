export type Entry = { service: string; port: number }

export type Launcher = { kind: 'docker'; watch: boolean } | { kind: 'node'; manager: string; scripts: string[] }

export type ServiceState = 'running' | 'starting' | 'unhealthy' | 'restarting' | 'crashed' | 'exited' | 'stopped'

export type Service = { name: string; state: ServiceState; exitCode?: number }

export type Project = {
  name: string
  root: string
  apps: Entry[]
  launcher?: Launcher
  listening: number[]
  serviceNames?: string[]
  services?: Service[]
  startedAt?: number
  stoppingAt?: number
  failure?: string
}

declare module 'claude-code' {
  interface PluginState {
    'dev-apps': { project: Project | null }
  }
}
