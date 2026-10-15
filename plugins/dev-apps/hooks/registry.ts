import type { Entry } from '../types'

const BROWSER = /^(web|backoffice|admin|storybook.*|docs.*)$/

export function browserApps(tsv: string, project: string): Entry[] {
  return tsv
    .split('\n')
    .filter(line => line.trim() && !line.startsWith('#'))
    .map(line => line.trim().split('\t'))
    .filter(([, name, service = '']) => name === project && BROWSER.test(service))
    .map(([port, , service = '']) => ({ service, port: Number(port) }))
}
