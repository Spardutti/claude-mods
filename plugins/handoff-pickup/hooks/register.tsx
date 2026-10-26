import type { EngineInterface, Register } from 'claude-code'

import { handoffFiles, handoffTitle } from './waiting'

const COMMAND = 'pickup'

// Module state, not $.state: /clear keeps this module loaded, and the pick belongs to this session.
let pickedUp: string | undefined
let cwd = ''

// Kept in $.store so a reload or another session skips a handoff already being worked from.
const pickKey = (path: string) => `picked:${cwd}/${path}`

async function markPicked($: EngineInterface, path: string) {
  pickedUp = path
  await $.store.set(pickKey(path), true)
}

async function unpickedHandoffs($: EngineInterface, folder: string) {
  const entries = await $.fs.list(folder).catch(() => [])
  const picked = new Set(await $.store.keys())
  return handoffFiles(entries).filter(e => !picked.has(pickKey(`${folder}/${e.name}`)))
}

async function pickUp($: EngineInterface, folder: string) {
  const [newest] = await unpickedHandoffs($, folder)
  if (!newest) return { text: `No handoff waiting in ${folder}.` }
  const path = `${folder}/${newest.name}`
  const title = handoffTitle(newest.name, await $.fs.read(path))
  await markPicked($, path)
  return {
    text: `Picked up: ${title}. Send any message to start.`,
    context: [`Read ${path} and continue from it. When the work is done, tell the person to run /pickup done to delete it.`],
  }
}

async function finish($: EngineInterface) {
  const path = pickedUp
  if (!path) return { text: 'Nothing picked up in this session. Run /pickup first.' }
  const { exitCode } = await $.process.run(['rm', '--', path])
  if (exitCode !== 0) return { text: `Could not delete ${path}.` }
  pickedUp = undefined
  await $.store.delete(pickKey(path))
  return { text: `Deleted ${path}.` }
}

export const register: Register = (on, options) => {
  const folder = String(options.folder).replace(/\/+$/, '')
  const resumed = new RegExp(`^Read (${folder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/[\\w-][\\w.-]*\\.md) and continue\\.$`)

  on('session.start', async ($, e, next) => {
    cwd = e.cwd
    await $.command.register({ name: COMMAND, description: 'Pick up the newest handoff, "/pickup done" to delete it' })
    return next(e)
  })

  on('command.run', { command: COMMAND }, async ($, e) => {
    if (e.args.trim() === 'done') return finish($)
    return pickUp($, folder)
  })

  // auto-handoff resumes with this exact prompt, so its handoff counts as picked up here.
  on('prompt.submit', async ($, e, next) => {
    const path = e.text.match(resumed)?.[1]
    if (path) await markPicked($, path)
    return next(e)
  })
}
