export type Entry = { service: string; port: number }

export type Launcher = { kind: 'docker' } | { kind: 'node'; manager: string; scripts: string[] }

export type Project = {
  name: string
  root: string
  apps: Entry[]
  launcher?: Launcher
  listening: number[]
  startedAt?: number
}

declare module 'claude-code' {
  interface PluginState {
    'dev-apps': { project: Project | null }
  }
}
