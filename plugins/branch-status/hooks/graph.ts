export type Segment = { text: string; color?: string; bold?: boolean; dimColor?: boolean }

export type Row = { lead: Segment[]; tail: Segment[] }

export type Lane = {
  name: string
  color: string
  note?: Segment
  warning?: string
  isYou?: boolean
}

const STEP = '  '

function nodeLead(lane: Lane, depth: number): Segment[] {
  if (depth === 0) return [{ text: '● ', color: lane.color }]
  return [{ text: STEP.repeat(depth - 1) }, { text: '└─● ', color: lane.color }]
}

function notesLead(depth: number, next?: Lane): Segment[] {
  return [{ text: STEP.repeat(depth) }, next ? { text: '│ ', color: next.color } : { text: STEP }]
}

// Each lane hangs off the one above; its notes sit beneath it, so a deep lane still has room for words.
export function drawLanes(lanes: Lane[]): Row[] {
  return lanes.flatMap((lane, depth) => {
    const name = { text: lane.name, color: lane.color, bold: lane.isYou }
    const node = { lead: nodeLead(lane, depth), tail: lane.isYou ? [name, { text: '  ← you', bold: true }] : [name] }
    const notes = [lane.note, lane.warning ? { text: lane.warning, color: 'red' } : undefined]
      .filter(note => note !== undefined)
      .map(note => ({ lead: notesLead(depth, lanes[depth + 1]), tail: [note] }))
    return [node, ...notes]
  })
}

export function shortSubject(subject: string) {
  const pr = subject.match(/^Merge pull request (#\d+) from [^/]+\/(.+)$/)
  if (pr) return `${pr[1]}  ${pr[2]}`
  return subject.match(/^Merge branch '([^']+)'/)?.[1] ?? subject
}
