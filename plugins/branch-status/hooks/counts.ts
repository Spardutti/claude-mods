export function parseCounts(stdout: string): { behind: number; ahead: number } | undefined {
  const [behind = NaN, ahead = NaN] = stdout.trim().split(/\s+/).map(Number)
  return Number.isFinite(behind) && Number.isFinite(ahead) ? { behind, ahead } : undefined
}
