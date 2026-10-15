export const START_MS = 90_000

export type Status = 'stopped' | 'starting' | 'running' | 'failed'

export function listeningPorts(ss: string): number[] {
  const ports = ss
    .split('\n')
    .map(line => line.trim().split(/\s+/)[3])
    .map(local => Number(local?.slice(local.lastIndexOf(':') + 1)))
    .filter(port => port > 0)
  return [...new Set(ports)]
}

export function statusOf(isListening: boolean, startedAt: number | undefined, now: number): Status {
  if (isListening) return 'running'
  if (startedAt === undefined) return 'stopped'
  return now - startedAt <= START_MS ? 'starting' : 'failed'
}
