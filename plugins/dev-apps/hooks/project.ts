const lastPart = (path: string) => path.replace(/\/+$/, '').split('/').pop() ?? ''

export function projectName(commonDir: string | undefined, cwd: string): string {
  const dir = commonDir?.trim()
  if (!dir) return lastPart(cwd)
  return lastPart(dir.endsWith('/.git') ? dir.slice(0, -'/.git'.length) : dir)
}
