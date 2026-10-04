export type Entry = { name: string; kind: string; mtimeMs: number }

const HOUR = 3_600_000
const DAY = 24 * HOUR

// A handoff written within the hour is most likely being worked from right now.
export function waitingFiles(entries: readonly Entry[], now: number): Entry[] {
  return entries
    .filter(e => e.kind === 'file' && e.name.endsWith('.md') && now - e.mtimeMs >= HOUR)
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
}

export function handoffTitle(name: string, doc: string): string {
  const subject = doc.match(/^#\s*Handoff\s*[—–-]\s*(.+)$/m)?.[1]?.trim()
  return subject || name.replace(/\.md$/, '').replace(/^\d{4}-\d{2}-\d{2}-/, '')
}

export function ageOf(mtimeMs: number, now: number): string {
  const days = Math.floor((now - mtimeMs) / DAY)
  if (days === 0) return 'today'
  return days === 1 ? 'yesterday' : `${days} days ago`
}
