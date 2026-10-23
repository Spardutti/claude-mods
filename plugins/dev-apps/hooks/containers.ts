import type { Service, ServiceState } from '../types'

type Row = { Service: string; State: string; Health?: string; ExitCode?: number; Labels?: string }

// 130, 137 and 143 are what Ctrl-C, a kill and `docker compose stop` leave behind.
const STOP_CODES = [0, 130, 137, 143]

const UP: ServiceState[] = ['running', 'starting', 'unhealthy', 'restarting']

// A service with no container may be one that is never meant to run, so only a crash counts as down.
const DOWN: ServiceState[] = ['crashed']

// Compose v2.21+ prints one object per line; older versions print one array on one line.
function rowsOf(line: string): Row[] {
  try {
    const parsed = JSON.parse(line)
    return Array.isArray(parsed) ? parsed : [parsed]
  } catch {
    return []
  }
}

const HEALTH: Record<string, ServiceState> = { unhealthy: 'unhealthy', starting: 'starting' }

const exitedState = (code = 0): ServiceState => (STOP_CODES.includes(code) ? 'exited' : 'crashed')

function stateOf(row: Row | undefined): ServiceState {
  if (row?.State === 'running') return HEALTH[row.Health ?? ''] ?? 'running'
  if (row?.State === 'restarting') return 'restarting'
  if (row?.State === 'exited' || row?.State === 'dead') return exitedState(row.ExitCode)
  return 'stopped'
}

export function servicesOf(ps: string, names: string[]): Service[] {
  const rows = ps.split('\n').filter(line => line.trim()).flatMap(rowsOf).filter(row => !row.Labels?.includes('com.docker.compose.oneoff=True'))
  const all = names.length ? names : [...new Set(rows.map(row => row.Service))]
  return all.map(name => {
    const replicas = rows.filter(r => r.Service === name)
    const row = replicas.find(r => stateOf(r) === 'crashed') ?? replicas[0]
    const state = stateOf(row)
    return state === 'crashed' ? { name, state, exitCode: row?.ExitCode } : { name, state }
  })
}

export const isAnyUp = (services: Service[] = []) => services.some(service => UP.includes(service.state))

export const isAnyDown = (services: Service[] = []) => services.some(service => DOWN.includes(service.state))

export const serviceNames = (config = '') => config.split('\n').map(line => line.trim()).filter(Boolean)
