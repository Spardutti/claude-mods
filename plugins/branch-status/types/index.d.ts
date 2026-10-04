export type Snapshot = {
  branch: string
  ahead?: number
  behind?: number
  unreleased?: string[]
  error?: string
}

declare module 'claude-code' {
  interface PluginState {
    'branch-status': { snapshot: Snapshot }
  }
}
