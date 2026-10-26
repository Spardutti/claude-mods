export type Entry = { name: string; kind: string; mtimeMs: number }

export function handoffFiles(entries: readonly Entry[]): Entry[] {
  return entries
    .filter(e => e.kind === 'file' && e.name.endsWith('.md'))
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
}

export function handoffTitle(name: string, doc: string): string {
  const subject = doc.match(/^#\s*Handoff\s*[—–-]\s*(.+)$/m)?.[1]?.trim()
  return subject || name.replace(/\.md$/, '').replace(/^\d{4}-\d{2}-\d{2}-/, '')
}
