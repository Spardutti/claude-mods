export type Notice = { percent: number; threshold: number; secondsLeft?: number }

declare module 'claude-code' {
  interface PluginState {
    'auto-handoff': { notice: Notice | null }
  }
}
