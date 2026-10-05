export type LocalBranch = { name: string; isGone: boolean }

// Reads `git for-each-ref --format=%(refname:short)%09%(upstream:track) refs/heads`.
export function parseBranches(stdout: string): LocalBranch[] {
  return stdout
    .split('\n')
    .filter(Boolean)
    .map(line => {
      const [name = '', track = ''] = line.split('\t')
      return { name, isGone: track === '[gone]' }
    })
}

// A branch whose upstream is gone was deleted on origin, almost always after its PR merged.
export function openCandidates(branches: LocalBranch[], current: string, longLived: string[]): string[] {
  return branches
    .filter(b => !b.isGone && b.name !== current && !longLived.includes(b.name) && !b.name.startsWith('release/'))
    .map(b => b.name)
}
