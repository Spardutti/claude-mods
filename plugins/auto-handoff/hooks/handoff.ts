// Only a file the handoff skill writes is accepted: .claude/handoffs/<name>.md, no slashes or dots up.
// Matched anywhere in the answer, since output styles reword the skill's "Handoff written:" line.
export function handoffPath(answer: string): string | undefined {
  return answer.match(/\.claude\/handoffs\/[\w-][\w.-]*\.md\b/)?.[0]
}

export function resumePrompt(path: string, replies: string[], running: string[]): string {
  const parts = [`Read ${path} and continue.`]
  const said = replies.join('\n\n').trim()
  if (said) {
    parts.push(`The reset hid your last reply, below. Repeat to the user anything in it beyond the handoff path.\n\n${said}`)
  }
  if (running.length) {
    const list = running.map(task => `- ${task}`).join('\n')
    parts.push(`These background tasks started before the reset. When one reports back, that is not the user's answer:\n${list}`)
  }
  return parts.join('\n\n')
}

export function sessionName(path: string, doc: string): string {
  const subject = doc.match(/^#\s*Handoff\s*[—–-]\s*(.+)$/m)?.[1]?.trim()
  if (subject) return subject
  const file = path.split('/').pop() ?? path
  return file.replace(/\.md$/, '').replace(/^\d{4}-\d{2}-\d{2}-/, '')
}
