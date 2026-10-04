export type Segment = { text: string; color?: string; bold?: boolean; dimColor?: boolean }

export type Row = { lead: Segment[]; tail: Segment[] }

export type Lane = {
  name: string
  color: string
  commits?: number
  note?: Segment
  warning?: string
  isYou?: boolean
}

const NAME_WIDTH = 12
const MAX_DOTS = 4
const MIN_WIDTH = 8

function dots(count: number) {
  if (count === 0) return '─'
  const shown = Array<string>(Math.min(count, MAX_DOTS)).fill('●').join('─')
  return count > MAX_DOTS ? `${shown}┄` : shown
}

function fit(name: string) {
  return name.length < NAME_WIDTH ? name.padEnd(NAME_WIDTH) : `${name.slice(0, NAME_WIDTH - 2)}… `
}

// The first lane is the trunk; each later lane forks off the last commit of the one above it.
export function drawLanes(lanes: Lane[]): Row[] {
  let start = 0
  const placed = lanes.map((lane, i) => {
    const graph = i === 0 ? '●' : dots(lane.commits ?? 0)
    if (i > 0) start += 2
    const spot = { lane, graph, start, isTrunk: i === 0 }
    start += graph.length - 1
    return spot
  })
  const width = Math.max(MIN_WIDTH, ...placed.map(p => p.start + p.graph.length))

  return placed.flatMap(({ lane, graph, start, isTrunk }) => {
    const rows: Row[] = []
    const indent = { text: ' '.repeat(NAME_WIDTH + start) }
    if (!isTrunk) rows.push({ lead: [{ text: ' '.repeat(NAME_WIDTH + start - 1) }, { text: '╲', color: lane.color }], tail: [] })
    rows.push({
      lead: [
        { text: fit(lane.name), color: lane.color, bold: lane.isYou },
        { text: ' '.repeat(start) },
        { text: (isTrunk ? graph.padEnd(width, '─') : graph).padEnd(width - start + 2), color: lane.color },
      ],
      tail: [...(lane.note ? [lane.note] : []), ...(lane.isYou ? [{ text: '  ←\u00A0you', bold: true }] : [])],
    })
    if (lane.name.length >= NAME_WIDTH) rows.push({ lead: [indent], tail: [{ text: lane.name, color: lane.color }] })
    if (lane.warning) rows.push({ lead: [indent], tail: [{ text: lane.warning, color: 'red' }] })
    return rows
  })
}

export function shortSubject(subject: string) {
  const pr = subject.match(/^Merge pull request (#\d+) from [^/]+\/(.+)$/)
  if (pr) return `${pr[1]}  ${pr[2]}`
  return subject.match(/^Merge branch '([^']+)'/)?.[1] ?? subject
}
