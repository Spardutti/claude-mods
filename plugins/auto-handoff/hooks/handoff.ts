// Only a file the handoff skill writes is accepted: .claude/handoffs/<name>.md, no slashes or dots up.
export function handoffPath(answer: string): string | undefined {
  return answer.match(/Handoff written:\s*`?(\.claude\/handoffs\/[\w-]+\.md)\b/)?.[1]
}

export function sessionName(path: string, doc: string): string {
  const subject = doc.match(/^#\s*Handoff\s*[—–-]\s*(.+)$/m)?.[1]?.trim()
  if (subject) return subject
  const file = path.split('/').pop() ?? path
  return file.replace(/\.md$/, '').replace(/^\d{4}-\d{2}-\d{2}-/, '')
}
