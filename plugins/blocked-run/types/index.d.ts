export type Blocked = { command: string; status: 'waiting' | 'running' | 'done'; lastLine?: string; exitCode?: number; note?: string }

declare module 'claude-code' {
  interface PluginState {
    'blocked-run': { blocked: Blocked | null }
  }
}
