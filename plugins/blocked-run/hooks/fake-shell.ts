import type { RenderElement } from 'claude-code'
import type { TestBody } from 'claude-code/testing'

export type Engine = Parameters<TestBody>[0]
export type On = Parameters<TestBody>[1]

export const COMMAND = 'gh pr merge 12 --squash'
export const BAND_PROPS = { hasSurvey: false, isWorking: false, maxRows: 4, bodyColumns: 100, scroll: { offset: 0, bodyRows: 4 }, view: {} } as const

export function fakeShell(on: On, exitCode = 0, output = 'Merged #12\n') {
  const ran: { argv: string[]; cwd?: string }[] = []
  const toasts: string[] = []
  let gate: Promise<void> | undefined
  const hold = () => {
    let release = () => {}
    gate = new Promise(resolve => (release = resolve))
    return release
  }
  on('session.start', async (_, e) => ({ cwd: e.cwd }))
  on('classic.PermissionDenied', async () => ({}))
  on('classic.Stop', async () => ({}))
  on('prompt.submit', async (_, e) => ({ text: e.text, context: e.context }))
  on('ui.render', async ($, e) => h($.ui.resolve(e).Text, {}, 'engine band') as RenderElement)
  on('ui.toast', async (_, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('process.spawn', async function* (_, e) {
    ran.push({ argv: [...e.argv], cwd: e.cwd })
    yield { stream: 'stdout' as const, text: output }
    await gate
    return { value: { code: exitCode, signal: null } }
  })
  return { ran, toasts, hold }
}

export async function blockBash($: Engine, tool = 'Bash') {
  await $.session.start({ cwd: '/project', surface: 'terminal', isInteractive: true })
  await $.classic.PermissionDenied({ tool_name: tool, tool_input: { command: COMMAND }, tool_use_id: 't1', reason: 'merge' })
}

export const mount = ($: Engine, surface: 'terminal' | 'desktop' = 'terminal') =>
  $.ui.mount({ plugin: 'blocked-run', surface, component: 'AbovePrompt', props: BAND_PROPS })


export async function askInReply($: Engine, reply = `Run this one:\n\n! ${COMMAND}\n`) {
  await $.session.start({ cwd: '/project', surface: 'terminal', isInteractive: true })
  await $.classic.Stop({ session_id: 's', transcript_path: '', cwd: '', stop_hook_active: false, last_assistant_message: reply, background_tasks: [] })
}


export const submit = async ($: Engine) => (await $.prompt.submit({ text: 'done', wait: false, origin: { kind: 'composer' } })).context

export const settle = () => new Promise(resolve => setTimeout(resolve, 0))
