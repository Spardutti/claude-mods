export type Waiting = { path: string; title: string; age: string; more: number }

declare module 'claude-code' {
  interface PluginState {
    'handoff-pickup': { waiting: Waiting | null }
  }
}
