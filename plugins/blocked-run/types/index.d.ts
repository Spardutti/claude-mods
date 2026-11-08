export type Pending = { command: string; asked?: boolean }
export type Blocked = Pending & { status: 'waiting' | 'running' | 'done'; lastLine?: string; exitCode?: number; note?: string; queue?: Pending[] }

declare module 'claude-code' {
  interface PluginState {
    'blocked-run': { blocked: Blocked | null }
  }
}
