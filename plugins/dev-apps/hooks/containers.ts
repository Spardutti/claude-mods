import type { Service, ServiceState } from '../types'

type Row = { Service: string; State: string; Health?: string; ExitCode?: number; Labels?: string }

// 130, 137 and 143 are what Ctrl-C, a kill and `docker compose stop` leave behind.
const STOP_CODES = [0, 130, 137, 143]

const UP: ServiceState[] = ['running', 'starting', 'unhealthy', 'restarting']

const DOWN: ServiceState[] = ['crashed', 'stopped']

// Compose v2.21+ prints one object per line; older versions print one array.
function rowsOf(ps: string): Row[] {
  const text = ps.trim()
  try {
    return text.startsWith('[') ? JSON.parse(text) : text.split('\n').filter(Boolean).map(line => JSON.parse(line))
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
  const rows = rowsOf(ps).filter(row => !row.Labels?.includes('com.docker.compose.oneoff=True'))
  const all = names.length ? names : [...new Set(rows.map(row => row.Service))]
  return all.map(name => {
    const row = rows.find(r => r.Service === name)
    const state = stateOf(row)
    return state === 'crashed' ? { name, state, exitCode: row?.ExitCode } : { name, state }
  })
}

export const isAnyUp = (services: Service[] = []) => services.some(service => UP.includes(service.state))

export const isAnyDown = (services: Service[] = []) => services.some(service => DOWN.includes(service.state))

export const serviceNames = (config = '') => config.split('\n').map(line => line.trim()).filter(Boolean)
