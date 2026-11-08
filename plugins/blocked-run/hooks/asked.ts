const OWN_LINE = /^\s*!\s+(\S.*?)\s*$/
const IN_BACKTICKS = /`!\s+([^`\s][^`]*?)\s*`/g

export function askedCommandsOf(reply: string): string[] {
  return reply.split('\n').flatMap(line => {
    const quoted = [...line.matchAll(IN_BACKTICKS)].map(m => m[1])
    const own = OWN_LINE.exec(line)?.[1]
    return quoted.length ? quoted : own ? [own] : []
  })
}
