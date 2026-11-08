const OWN_LINE = /^\s*!\s+(\S[\s\S]*?)\s*$/
const IN_BACKTICKS = /`!\s+([^`\s][^`]*?)\s*`/g
const FENCE = /^\s*```/

type Chunk = { isFenced: boolean; lines: string[] }

function chunksOf(reply: string): Chunk[] {
  const chunks: Chunk[] = [{ isFenced: false, lines: [] }]
  for (const line of reply.split('\n')) {
    const last = chunks[chunks.length - 1]
    if (FENCE.test(line)) chunks.push({ isFenced: !last.isFenced, lines: [] })
    else last.lines.push(line)
  }
  return chunks
}

function joinContinued(lines: string[]): string[] {
  const joined: string[] = []
  for (const line of lines) {
    const last = joined.length - 1
    if (last >= 0 && joined[last].trimEnd().endsWith('\\')) joined[last] = `${joined[last]}\n${line}`
    else joined.push(line)
  }
  return joined
}

function commandsOnLine(line: string): string[] {
  const quoted = [...line.matchAll(IN_BACKTICKS)].map(m => m[1])
  const own = OWN_LINE.exec(line)?.[1]
  return quoted.length ? quoted : own ? [own] : []
}

// A fenced block counts only when every line in it is an ask, so a script's `! grep` stays out.
function commandsIn({ isFenced, lines }: Chunk): string[] {
  const joined = joinContinued(lines).filter(line => line.trim())
  if (!isFenced) return joined.flatMap(commandsOnLine)
  const own = joined.map(line => OWN_LINE.exec(line)?.[1])
  return own.every(Boolean) ? (own as string[]) : []
}

export const askedCommandsOf = (reply: string): string[] => chunksOf(reply).flatMap(commandsIn)
