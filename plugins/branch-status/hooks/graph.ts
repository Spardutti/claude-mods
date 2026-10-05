export type Segment = { text: string; color?: string; bold?: boolean; dimColor?: boolean }

export type Row = { lead: Segment[]; tail: Segment[] }

export type Lane = {
  name: string
  color: string
  depth: number
  note?: Segment
  commits?: string[]
  total?: number
  hint?: string
  warning?: string
  isYou?: boolean
}

const STEP = '  '
const MAX_COMMITS = 5

function laterSibling(lanes: Lane[], i: number): Lane | undefined {
  const depth = lanes[i]?.depth ?? 0
  for (const lane of lanes.slice(i + 1)) {
    if (lane.depth < depth) return undefined
    if (lane.depth === depth) return lane
  }
  return undefined
}

function ancestorIndex(lanes: Lane[], i: number, depth: number) {
  let j = i
  while (j > 0 && (lanes[j]?.depth ?? 0) > depth) j -= 1
  return j
}

// One column per level: a line runs down where that level still has a branch to come.
function rail(lanes: Lane[], i: number, levels: number): Segment[] {
  return Array.from({ length: levels }, (_, k) => {
    const sibling = laterSibling(lanes, ancestorIndex(lanes, i, k + 1))
    return sibling ? { text: '│ ', color: sibling.color } : { text: STEP }
  })
}

function nodeLead(lanes: Lane[], i: number, lane: Lane): Segment[] {
  if (lane.depth === 0) return [{ text: '● ', color: lane.color }]
  const fork = laterSibling(lanes, i) ? '├─● ' : '└─● '
  return [...rail(lanes, i, lane.depth - 1), { text: fork, color: lane.color }]
}

function notesLead(lanes: Lane[], i: number, lane: Lane): Segment[] {
  const child = lanes[i + 1]?.depth === lane.depth + 1 ? lanes[i + 1] : undefined
  return [...rail(lanes, i, lane.depth), child ? { text: '│ ', color: child.color } : { text: STEP }]
}

function commitRows(lead: Segment[], lane: Lane): Row[] {
  const commits = lane.commits ?? []
  const more = (lane.total ?? commits.length) - MAX_COMMITS
  const rows = commits.slice(0, MAX_COMMITS).map(text => ({ lead: [...lead, { text: '· ', dimColor: true }], tail: [{ text }] }))
  return more > 0 ? [...rows, { lead, tail: [{ text: `+${more} more`, dimColor: true }] }] : rows
}

function laneRows(lanes: Lane[], i: number, lane: Lane): Row[] {
  const name = { text: lane.name, color: lane.color, bold: lane.isYou }
  const node = { lead: nodeLead(lanes, i, lane), tail: lane.isYou ? [name, { text: '  ← you', bold: true }] : [name] }
  const lead = notesLead(lanes, i, lane)
  const line = (segment?: Segment) => (segment ? [{ lead, tail: [segment] }] : [])
  return [
    node,
    ...line(lane.note),
    ...commitRows(lead, lane),
    ...line(lane.hint ? { text: lane.hint, dimColor: true } : undefined),
    ...line(lane.warning ? { text: lane.warning, color: 'red' } : undefined),
  ]
}

// Lanes come in tree order, each with its depth; notes sit beneath their lane, so depth costs little width.
export function drawLanes(lanes: Lane[]): Row[] {
  return lanes.flatMap((lane, i) => laneRows(lanes, i, lane))
}

export function shortSubject(subject: string) {
  const pr = subject.match(/^Merge pull request (#\d+) from [^/]+\/(.+)$/)
  if (pr) return `${pr[1]}  ${pr[2]}`
  return subject.match(/^Merge branch '([^']+)'/)?.[1] ?? subject
}
