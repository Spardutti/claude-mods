import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Waiting } from '../types'
import { ageOf, handoffTitle, waitingFiles } from './waiting'

const COMMAND = 'pickup'
const REFRESH_MS = 5 * 60_000
const ref = { plugin: 'handoff-pickup', key: 'waiting' } as const
const waiting = atom(ref, null as Waiting | null)

// Module state, not $.state: /clear keeps this module loaded, and the pick belongs to this session.
let pickedUp: string | undefined
let cwd = ''

// Kept in $.store so a reload or another session still hides a handoff already being worked from.
const pickKey = (path: string) => `picked:${cwd}/${path}`

async function markPicked($: EngineInterface, path: string) {
  pickedUp = path
  await $.store.set(pickKey(path), true)
}

async function refresh($: EngineInterface, folder: string) {
  const entries = await $.fs.list(folder).catch(() => [])
  const now = await $.clock.now()
  const picked = new Set(await $.store.keys())
  const files = waitingFiles(entries, now).filter(e => !picked.has(pickKey(`${folder}/${e.name}`)))
  const [newest] = files
  if (!newest) return update($, waiting, () => null)
  const path = `${folder}/${newest.name}`
  const title = handoffTitle(newest.name, await $.fs.read(path))
  await update($, waiting, () => ({ path, title, age: ageOf(newest.mtimeMs, now), more: files.length - 1 }))
}

async function pickUp($: EngineInterface, folder: string) {
  const { value: shown } = await $.state.get(ref)
  if (!shown) return { text: `No handoff waiting in ${folder}.` }
  await markPicked($, shown.path)
  await refresh($, folder)
  return {
    text: `Picked up: ${shown.title}. Send any message to start.`,
    context: [`Read ${shown.path} and continue from it. When the work is done, tell the person to run /pickup done to delete it.`],
  }
}

async function dismiss($: EngineInterface, folder: string) {
  const { value: shown } = await $.state.get(ref)
  if (!shown) return { text: `No handoff waiting in ${folder}.` }
  await $.store.set(pickKey(shown.path), true)
  await refresh($, folder)
  return { text: `Hid ${shown.path}. The file is still there.` }
}

async function finish($: EngineInterface, folder: string) {
  const path = pickedUp
  if (!path) return { text: 'Nothing picked up in this session. Run /pickup first.' }
  const { exitCode } = await $.process.run(['rm', '--', path])
  if (exitCode !== 0) return { text: `Could not delete ${path}.` }
  pickedUp = undefined
  await $.store.delete(pickKey(path))
  await refresh($, folder)
  return { text: `Deleted ${path}.` }
}

export const register: Register = (on, options) => {
  const folder = String(options.folder).replace(/\/+$/, '')
  const resumed = new RegExp(`^Read (${folder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/[\\w-][\\w.-]*\\.md) and continue\\.$`)

  on('session.start', async ($, e, next) => {
    cwd = e.cwd
    await $.command.register({ name: COMMAND, description: 'Pick up the waiting handoff, "/pickup done" to delete it, "/pickup dismiss" to hide it' })
    await refresh($, folder)
    $.clock.every(REFRESH_MS, () => void refresh($, folder))
    return next(e)
  })

  on('command.run', { command: COMMAND }, async ($, e) => {
    const arg = e.args.trim()
    if (arg === 'done') return finish($, folder)
    if (arg === 'dismiss') return dismiss($, folder)
    return pickUp($, folder)
  })

  // auto-handoff resumes with this exact prompt, so its handoff counts as picked up here.
  on('prompt.submit', async ($, e, next) => {
    const path = e.text.match(resumed)?.[1]
    if (path) await markPicked($, path)
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const shown = await read($, waiting)
    if (e.props.hasSurvey || !shown) return next(e)
    const { Text } = $.ui.resolve(e)
    const more = shown.more ? ` (+${shown.more} more)` : ''
    return (
      <Text>
        <Text color="yellow">Handoff waiting:</Text> {shown.title} ({shown.age}){more} · <Text bold>/pickup</Text>
      </Text>
    )
  })
}
