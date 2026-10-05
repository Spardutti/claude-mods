import type { OpenBranch, Snapshot } from '../types'
import { openCandidates, parseBranches } from './branches'
import { parseCounts } from './counts'

export const BASE = 'main'
export const RELEASE = 'develop'
const MAX_COMMITS = 5

export type Git = (args: string[]) => Promise<string | undefined>

async function hasRef(git: Git, ref: string) {
  return (await git(['rev-parse', '--verify', '-q', ref])) !== undefined
}

async function drift(git: Git, from: string, to: string) {
  return parseCounts((await git(['rev-list', '--no-merges', '--left-right', '--count', `${from}...${to}`])) ?? '') ?? { ahead: 0, behind: 0 }
}

async function commitsOf(git: Git, from: string, to: string) {
  return ((await git(['log', '--no-merges', '--format=%s', '-n', String(MAX_COMMITS), `${from}..${to}`])) ?? '').split('\n').filter(Boolean)
}

// A merge whose side branch holds no commits missing from base (a sync from main) has nothing to release.
async function bringsWork(git: Git, base: string, hash: string) {
  return (await git(['rev-list', '--no-merges', '--count', `${base}..${hash}^2`]))?.trim() !== '0'
}

async function unreleased(git: Git, base: string, ref: string) {
  const lines = ((await git(['log', '--first-parent', '--format=%H %s', `${base}..${ref}`])) ?? '').split('\n').filter(Boolean)
  const kept: string[] = []
  for (const line of lines) {
    const [hash = '', ...subject] = line.split(' ')
    if (await bringsWork(git, base, hash)) kept.push(subject.join(' '))
  }
  return kept
}

// Branches other than yours are read from origin, since local copies of them go stale.
async function refOf(git: Git, name: string, branch: string) {
  return name !== branch && (await hasRef(git, `origin/${name}`)) ? `origin/${name}` : name
}

// Commits whose change is not in ref yet; --cherry-pick also drops ones squash-merged there.
async function missingFrom(git: Git, ref: string, name: string) {
  const lines = ((await git(['log', '--no-merges', '--cherry-pick', '--right-only', '--format=%H %s', `${ref}...${name}`])) ?? '').split('\n')
  return lines.filter(Boolean).map(line => ({ hash: line.slice(0, line.indexOf(' ')), subject: line.slice(line.indexOf(' ') + 1) }))
}

// A branch merged straight into base, skipping the parent, is done too.
async function unmergedSubjects(git: Git, refs: { parent: string; base: string }, name: string) {
  const inBase = new Set((await missingFrom(git, refs.base, name)).map(c => c.hash))
  return (await missingFrom(git, refs.parent, name)).filter(c => inBase.has(c.hash)).map(c => c.subject)
}

async function openBranches(git: Git, refs: { parent: string; base: string }, names: string[]) {
  const open: OpenBranch[] = []
  for (const name of names) {
    const subjects = await unmergedSubjects(git, refs, name)
    if (subjects.length) open.push({ name, ahead: subjects.length, commits: subjects.slice(0, MAX_COMMITS) })
  }
  return open
}

type Parent = { name: string; ref: string }

async function releaseOf(git: Git, base: string, ref: string) {
  return { ...(await drift(git, base, ref)), merges: await unreleased(git, base, ref) }
}

async function workOf(git: Git, parent: Parent, isMerged: boolean) {
  return { parent: parent.name, isMerged, ...(await drift(git, parent.ref, 'HEAD')), commits: await commitsOf(git, parent.ref, 'HEAD') }
}

export async function collect(git: Git): Promise<Snapshot> {
  const branch = (await git(['rev-parse', '--abbrev-ref', 'HEAD']))?.trim()
  if (!branch) return { branch: '', error: 'Not a git repository.' }
  if (!(await hasRef(git, BASE))) return { branch, hasBase: false }

  const base = await refOf(git, BASE, branch)
  const hasRelease = await hasRef(git, RELEASE)
  const parent = hasRelease ? { name: RELEASE, ref: await refOf(git, RELEASE, branch) } : { name: BASE, ref: base }
  const release = hasRelease ? await releaseOf(git, base, parent.ref) : undefined
  const locals = parseBranches((await git(['for-each-ref', '--format=%(refname:short)%09%(upstream:track)', 'refs/heads'])) ?? '')
  const isLongLived = branch === BASE || branch === RELEASE
  const work = isLongLived ? undefined : await workOf(git, parent, locals.find(b => b.name === branch)?.isGone ?? false)
  const others = await openBranches(git, { parent: parent.ref, base }, openCandidates(locals, branch, [BASE, RELEASE]))

  return { branch, hasBase: true, release, work, others }
}
