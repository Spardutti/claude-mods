export type Drift = { ahead: number; behind: number }

export type OpenBranch = { name: string; ahead: number; commits: string[] }

export type Snapshot = {
  branch: string
  hasBase?: boolean
  release?: Drift & { merges: string[] }
  work?: Drift & { parent: string; commits: string[]; isMerged: boolean }
  others?: OpenBranch[]
  error?: string
}

declare module 'claude-code' {
  interface PluginState {
    'branch-status': { snapshot: Snapshot }
  }
}
