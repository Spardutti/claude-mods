export type Entry = { service: string; port: number }

export type Launcher = { kind: 'docker'; watch: boolean } | { kind: 'node'; manager: string; scripts: string[] }

export type Project = {
  name: string
  root: string
  apps: Entry[]
  launcher?: Launcher
  listening: number[]
  startedAt?: number
  stoppingAt?: number
  failure?: string
}

declare module 'claude-code' {
  interface PluginState {
    'dev-apps': { project: Project | null }
  }
}
