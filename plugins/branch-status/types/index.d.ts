export type Drift = { ahead: number; behind: number }

export type Snapshot = {
  branch: string
  hasBase?: boolean
  release?: Drift & { merges: string[] }
  work?: Drift & { parent: string }
  error?: string
}

declare module 'claude-code' {
  interface PluginState {
    'branch-status': { snapshot: Snapshot }
  }
}
